/**
 * Slack 通知 (incoming webhook)
 *
 * チャンネル別 webhook URL を環境変数で切替:
 *   SLACK_WEBHOOK_URL_CS_ALERTS       — 可用性/エラー系アラート
 *   SLACK_WEBHOOK_URL_CS_INCIDENT     — P0/P1 インシデント宣言
 *   SLACK_WEBHOOK_URL_CHURN_ALERTS    — 解約予兆 (severity high/critical)
 *   SLACK_WEBHOOK_URL_EXPANSION       — エクスパンション機会
 *   SLACK_WEBHOOK_URL_CS_OPPORTUNITY  — 旧名互換 (将来 EXPANSION に統合)
 *
 * 共通:
 *   - 未設定なら no-op + stderr フォールバック
 *   - fetchHard 経由 (timeout 5s + retry 2回)
 *   - 重複通知防止 (dedupKey) を24時間メモ。再送はキー違いで強制。
 *   - Block Kit を使い、本文 + actions[] (ダッシュボードへ・スヌーズ) を生成
 *
 * external ユーザー対応:
 *   本モジュールは社内 Slack へのチャンネル webhook のみを扱うため、
 *   external への直接配信は構造上発生しない。将来「個人宛メール /
 *   in-app 通知」を実装する際は lib/notifications/role-filter.ts の
 *   filterRecipientsByRole を経由して受信者を絞り込むこと。
 */

import 'server-only';
import { fetchHard } from '@/lib/security/http';
import { acquireDedup, releaseDedup } from './dedup';

export type SlackChannel =
  | 'CS_ALERTS'
  | 'CS_INCIDENT'
  | 'CS_OPPORTUNITY'
  | 'CHURN_ALERTS'
  | 'EXPANSION'
  | 'VOC'
  | 'HANDOFF'
  | 'AUDIT_FAILURE';

export interface SlackPayload {
  text: string;
  blocks?: unknown[];
  username?: string;
  icon_emoji?: string;
  channel?: string;
}

// ── 重複通知防止 ──
// 実装は lib/notifications/dedup.ts (driver: memory|supabase) に委譲。
// 環境変数 NOTIFICATION_DEDUP_DRIVER で切替。
// channel をスコープに含めることで CS_ALERTS と CHURN_ALERTS で同 dedupKey が
// 衝突しないようにする (slack:<channel> プレフィクス)。

export async function notifySlack(
  channel: SlackChannel,
  payload: SlackPayload,
  options?: { dedupKey?: string },
): Promise<boolean> {
  if (options?.dedupKey) {
    const acquired = await acquireDedup({
      channel: `slack:${channel}`,
      key: options.dedupKey,
    });
    if (!acquired) return false;
  }

  const url = process.env[`SLACK_WEBHOOK_URL_${channel}`];
  if (!url) {
    process.stderr.write(
      JSON.stringify({
        kind: 'slack_fallback',
        time: new Date().toISOString(),
        channel,
        text: payload.text,
        dedupKey: options?.dedupKey,
      }) + '\n',
    );
    // URL 未設定は通知できないため dedup を取消 (再送可能化)
    if (options?.dedupKey) await releaseDedup(`slack:${channel}`, options.dedupKey);
    return false;
  }

  try {
    const { response } = await fetchHard(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 5000,
      retries: 2,
      retryNonIdempotent: true,
    });
    if (!response.ok && options?.dedupKey) {
      // post 失敗 → 次回再送できるよう dedup 解放
      await releaseDedup(`slack:${channel}`, options.dedupKey);
    }
    return response.ok;
  } catch (e) {
    process.stderr.write(
      JSON.stringify({
        kind: 'slack_post_failed',
        channel,
        message: (e as Error).message,
      }) + '\n',
    );
    if (options?.dedupKey) await releaseDedup(`slack:${channel}`, options.dedupKey);
    return false;
  }
}

// ============================================================
// 解約予兆通知 (F項)
// ============================================================

export type ChurnSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * ストリーム02 D項 (解約予兆エンジン) から渡される確定ペイロード仕様。
 * 02側 churnSignalRepo の戻り値型と一致させる。
 */
export interface ChurnSignalNotification {
  signalId: string;          // churn_signals.id (UUID)
  contractId: string;
  companyName: string;
  severity: ChurnSeverity;
  reason: string;            // 1行要約 (例: "面談2週空白 + 出席率45%")
  evidence: string[];        // 詳細根拠 (3-5件、Block Kit で箇条書き)
  healthScore: number | null;
  detectedAt: string;        // ISO8601
  dashboardUrl: string;      // 例: https://cs.neoacademia.jp/companies/<id>
  ownerSlackUserId?: string | null;  // 担当CSのSlackメンションID (取れれば <@U...> でmention)
  ownerName?: string | null;
}

const SEVERITY_META: Record<ChurnSeverity, { emoji: string; color: string; label: string }> = {
  low:      { emoji: '🟢', color: '#10B981', label: 'Low' },
  medium:   { emoji: '🟡', color: '#F59E0B', label: 'Medium' },
  high:     { emoji: '🟠', color: '#FB923C', label: 'High' },
  critical: { emoji: '🔴', color: '#EF4444', label: 'Critical' },
};

/**
 * 解約予兆を Slack に通知する (F項エントリポイント)
 *
 * チャンネル: SLACK_WEBHOOK_URL_CHURN_ALERTS
 * 重複防止: signalId をキーに 24h
 *
 * メッセージ構造 (Block Kit):
 *   header   "🔴 解約予兆: <企業名> (Critical)"
 *   section  "1行理由"
 *           "担当: @owner / 健全度: 42 / 検知: 2026-05-03 14:00 JST"
 *   section  "根拠:" + evidence の箇条書き
 *   actions  [Dashboard を開く] [24hスヌーズ] [対応中マーク]
 */
export async function notifyChurnSignal(s: ChurnSignalNotification): Promise<boolean> {
  const meta = SEVERITY_META[s.severity];
  const mention = s.ownerSlackUserId ? `<@${s.ownerSlackUserId}>` : (s.ownerName ?? '未割当');
  const detectedJst = formatJst(s.detectedAt);

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${meta.emoji} 解約予兆: ${s.companyName} (${meta.label})`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${s.reason}*` },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `担当: ${mention}` },
        { type: 'mrkdwn', text: `健全度: *${s.healthScore ?? '—'}*` },
        { type: 'mrkdwn', text: `検知: ${detectedJst}` },
      ],
    },
  ];

  if (s.evidence.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*根拠:*\n' + s.evidence.slice(0, 5).map((e) => `• ${e}`).join('\n'),
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔍 ダッシュボードを開く', emoji: true },
        url: s.dashboardUrl,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '⏰ 24hスヌーズ', emoji: true },
        action_id: `churn_snooze:${s.signalId}`,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '🛠 対応中', emoji: true },
        action_id: `churn_ack:${s.signalId}`,
      },
    ],
  });

  // フォールバック text (notification preview, screen reader)
  const fallback = `[${meta.label}] 解約予兆 ${s.companyName}: ${s.reason} (担当 ${s.ownerName ?? '未割当'})`;

  return notifySlack(
    'CHURN_ALERTS',
    {
      text: fallback,
      blocks,
      username: 'NEO CS Watchdog',
      icon_emoji: ':rotating_light:',
    },
    { dedupKey: `churn:${s.signalId}` },
  );
}

// ============================================================
// エクスパンション機会通知 (F項)
// ============================================================

export interface ExpansionOpportunityNotification {
  opportunityId: string;
  contractId: string;
  companyName: string;
  reason: string;            // 例: "出席率95% + Champion 2名 + Goal達成80%"
  evidence: string[];
  healthScore: number | null;
  detectedAt: string;
  dashboardUrl: string;
  ownerSlackUserId?: string | null;
  ownerName?: string | null;
  estimatedUpsellJpy?: number | null;
}

export async function notifyExpansionOpportunity(
  e: ExpansionOpportunityNotification,
): Promise<boolean> {
  const mention = e.ownerSlackUserId ? `<@${e.ownerSlackUserId}>` : (e.ownerName ?? '未割当');
  const detectedJst = formatJst(e.detectedAt);
  const upsell = e.estimatedUpsellJpy != null
    ? `想定アップセル: ¥${e.estimatedUpsellJpy.toLocaleString('ja-JP')}`
    : null;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚀 エクスパンション機会: ${e.companyName}`,
        emoji: true,
      },
    },
    { type: 'section', text: { type: 'mrkdwn', text: `*${e.reason}*` } },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `担当: ${mention}` },
        { type: 'mrkdwn', text: `健全度: *${e.healthScore ?? '—'}*` },
        ...(upsell ? [{ type: 'mrkdwn', text: upsell }] : []),
        { type: 'mrkdwn', text: `検知: ${detectedJst}` },
      ],
    },
  ];

  if (e.evidence.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*根拠:*\n' + e.evidence.slice(0, 5).map((x) => `• ${x}`).join('\n'),
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔍 ダッシュボードを開く', emoji: true },
        url: e.dashboardUrl,
        style: 'primary',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '✋ 営業に連携', emoji: true },
        action_id: `expansion_to_sales:${e.opportunityId}`,
      },
    ],
  });

  return notifySlack(
    'EXPANSION',
    {
      text: `[Expansion] ${e.companyName}: ${e.reason}`,
      blocks,
      username: 'NEO CS Growth',
      icon_emoji: ':chart_with_upwards_trend:',
    },
    { dedupKey: `expansion:${e.opportunityId}` },
  );
}

function formatJst(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  } catch {
    return iso;
  }
}

// ============================================================
// VOC (Voice of Customer) 通知 (H項)
// ============================================================

export type VocPriority = 'low' | 'med' | 'high';
export type VocSource = 'survey_response' | 'meeting_log' | 'weekly_review';

/**
 * lib/notifications/voc.ts (02 H項) から渡される確定ペイロード仕様。
 * VocItemRecord をフラットに正規化したもの。
 */
export interface VocItemNotification {
  vocItemId: string;
  contractId?: string | null;
  companyName: string;
  excerpt: string;                  // 抜粋 (画面表示と同じ文字列)
  tags: string[];                   // 表示用ラベル化済 (VOC_TAG_LABEL適用後)
  priority: VocPriority;
  suggestedAction?: string | null;  // CS担当者への提案 (任意)
  sourceType: VocSource;
  detectedAt: string;               // ISO8601 (= vocItem.createdAt)
  dashboardUrl: string;             // 例: https://cs.neoacademia.jp/voc#<id>
  companyDashboardUrl?: string | null; // 任意
  assignedToName?: string | null;
}

const VOC_PRIORITY_META: Record<VocPriority, { emoji: string; label: string }> = {
  high: { emoji: '🔥', label: 'High' },
  med:  { emoji: '📌', label: 'Medium' },
  low:  { emoji: '💡', label: 'Low' }
};

const VOC_SOURCE_LABEL: Record<VocSource, string> = {
  survey_response: 'アンケート',
  meeting_log: '面談ログ',
  weekly_review: '週次レビュー'
};

/**
 * VOC を Slack に通知 (H項エントリポイント)
 *
 * チャンネル: SLACK_WEBHOOK_URL_VOC
 * 重複防止: vocItemId をキーに 24h
 *
 * メッセージ構造 (Block Kit):
 *   header   "🔥 VOC: <企業名> (High)"
 *   section  "> <抜粋>"
 *   context  "ソース: <type> / 担当: <name> / タグ: <tags> / 検出: <JST>"
 *   section  "💡 提案: <suggestedAction>" (suggestedAction があれば)
 *   actions  [VOC を開く] [企業カルテ]
 */
export async function notifyVocItem(v: VocItemNotification): Promise<boolean> {
  const meta = VOC_PRIORITY_META[v.priority];
  const detectedJst = formatJst(v.detectedAt);
  const tagText = v.tags.length > 0 ? v.tags.join(' / ') : '—';
  const sourceLabel = VOC_SOURCE_LABEL[v.sourceType];

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${meta.emoji} VOC: ${v.companyName} (${meta.label})`,
        emoji: true
      }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `> ${v.excerpt}` }
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `ソース: ${sourceLabel}` },
        { type: 'mrkdwn', text: `担当: ${v.assignedToName ?? '未割当'}` },
        { type: 'mrkdwn', text: `タグ: ${tagText}` },
        { type: 'mrkdwn', text: `検出: ${detectedJst}` }
      ]
    }
  ];

  if (v.suggestedAction) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*💡 提案:* ${v.suggestedAction}` }
    });
  }

  const actions: unknown[] = [
    {
      type: 'button',
      text: { type: 'plain_text', text: '📋 VOC を開く', emoji: true },
      url: v.dashboardUrl,
      style: 'primary'
    }
  ];
  if (v.companyDashboardUrl) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: '🏢 企業カルテ', emoji: true },
      url: v.companyDashboardUrl
    });
  }
  blocks.push({ type: 'actions', elements: actions });

  const fallback = `[${meta.label}] VOC ${v.companyName}: ${v.excerpt.slice(0, 80)}`;

  return notifySlack(
    'VOC',
    {
      text: fallback,
      blocks,
      username: 'NEO CS VOC',
      icon_emoji: ':speech_balloon:'
    },
    { dedupKey: v.vocItemId }
  );
}
