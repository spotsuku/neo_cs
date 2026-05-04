/**
 * 営業引継ぎ → Slack 通知 (Phase4-#6)
 *
 * チャンネル: SLACK_WEBHOOK_URL_HANDOFF
 *   未設定なら no-op + stderr フォールバック (slack.ts notifySlack の挙動)
 * 重複防止: salesDealId をキーに 24h
 */

import "server-only";
import { notifySlack } from "./slack";

export interface SalesHandoffNotification {
  salesDealId: string;
  companyName: string;
  productCode: string;
  startDate: string;
  amountJpy?: number | null;
  primaryContactName?: string | null;
  salesOwnerEmail?: string | null;
  dashboardUrl: string;
  receivedAt: string;
  notes?: string | null;
}

const PRODUCT_LABEL: Record<string, string> = {
  academia: "アカデミア",
  hyogikai: "評議会",
  aiken: "AI研",
  commu: "コミュ",
};

export async function notifySalesHandoff(p: SalesHandoffNotification): Promise<boolean> {
  const productLabel = PRODUCT_LABEL[p.productCode] ?? p.productCode;
  const amount = p.amountJpy != null ? `¥${p.amountJpy.toLocaleString("ja-JP")}` : "—";
  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🤝 営業引継ぎ: ${p.companyName} (${productLabel})`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${productLabel}* / 開始: ${p.startDate} / 想定: *${amount}*`,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `先方窓口: ${p.primaryContactName ?? "—"}` },
        { type: "mrkdwn", text: `営業担当: ${p.salesOwnerEmail ?? "—"}` },
        { type: "mrkdwn", text: `受信: ${p.receivedAt}` },
      ],
    },
  ];

  if (p.notes) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*メモ:* ${p.notes}` },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "📋 引継ぎを開く", emoji: true },
        url: p.dashboardUrl,
        style: "primary",
      },
    ],
  });

  return notifySlack(
    "HANDOFF",
    {
      text: `[Handoff] ${p.companyName} (${productLabel}) ${amount}`,
      blocks,
      username: "NEO CS Handoff",
      icon_emoji: ":handshake:",
    },
    { dedupKey: `handoff:${p.salesDealId}` },
  );
}
