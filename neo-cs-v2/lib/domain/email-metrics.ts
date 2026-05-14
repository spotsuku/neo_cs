// メール応答時間メトリクス (純関数)
//
// 各 inbound メッセージに対して、同一スレッド内で次に来る outbound メッセージまでの
// 経過時間 (分) を返す。outbound が無ければ未応答 (responseMinutes = null)。
//
// 利用箇所:
//   - 企業詳細: 応答時間の中央値・最遅・未応答件数
//   - manager: 担当 CS の応答速度ダッシュボード
//
// 注: 営業時間外を引いた "実応答時間" は今は実装しない (Phase 4 では raw 分のみ)。

export type EmailEventForMetrics = {
  /** メール ID (任意、デバッグ用) */
  id: string;
  /** スレッド ID */
  threadId: string;
  /** 'inbound' or 'outbound' */
  direction: "inbound" | "outbound";
  /** 送信日時 ISO */
  sentAt: string;
};

export type ResponseRecord = {
  inboundId: string;
  threadId: string;
  inboundAt: string;
  /** 該当 inbound に対して返した outbound (なければ null) */
  outboundId: string | null;
  outboundAt: string | null;
  /** 応答までの分数 (なければ null) */
  responseMinutes: number | null;
};

/** スレッド内の各 inbound メッセージに対し、次の outbound を 1 対 1 で紐付ける。 */
export function computeResponseRecords(
  events: EmailEventForMetrics[]
): ResponseRecord[] {
  // スレッド毎にグルーピング
  const byThread = new Map<string, EmailEventForMetrics[]>();
  for (const e of events) {
    const arr = byThread.get(e.threadId) ?? [];
    arr.push(e);
    byThread.set(e.threadId, arr);
  }

  const out: ResponseRecord[] = [];
  for (const [threadId, items] of byThread) {
    const sorted = items.slice().sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur.direction !== "inbound") continue;
      // i 以降で最初の outbound を探す
      let outbound: EmailEventForMetrics | undefined;
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].direction === "outbound") {
          outbound = sorted[j];
          break;
        }
      }
      const inboundAt = cur.sentAt;
      if (outbound) {
        const minutes = Math.max(
          0,
          Math.round(
            (new Date(outbound.sentAt).getTime() - new Date(inboundAt).getTime()) /
              60000
          )
        );
        out.push({
          inboundId: cur.id,
          threadId,
          inboundAt,
          outboundId: outbound.id,
          outboundAt: outbound.sentAt,
          responseMinutes: minutes
        });
      } else {
        out.push({
          inboundId: cur.id,
          threadId,
          inboundAt,
          outboundId: null,
          outboundAt: null,
          responseMinutes: null
        });
      }
    }
  }
  return out;
}

export type MetricsSummary = {
  totalInbound: number;
  responded: number;
  unresponded: number;
  /** 応答時間 (分) の中央値、未応答は除外 */
  medianMinutes: number | null;
  /** 95 パーセンタイル */
  p95Minutes: number | null;
  /** 24h 以内に返した割合 (0..1) */
  within24hRate: number | null;
};

export function summarizeMetrics(records: ResponseRecord[]): MetricsSummary {
  const totalInbound = records.length;
  const responded = records.filter((r) => r.responseMinutes !== null);
  const unresponded = totalInbound - responded.length;
  if (responded.length === 0) {
    return {
      totalInbound,
      responded: 0,
      unresponded,
      medianMinutes: null,
      p95Minutes: null,
      within24hRate: null
    };
  }
  const sorted = responded
    .map((r) => r.responseMinutes!)
    .sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const within24h = responded.filter((r) => (r.responseMinutes ?? 0) <= 24 * 60).length;
  return {
    totalInbound,
    responded: responded.length,
    unresponded,
    medianMinutes: median,
    p95Minutes: p95,
    within24hRate: within24h / responded.length
  };
}

/** 分 → 人間可読 ("3時間42分") */
export function humanizeMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}日${rh}時間` : `${d}日`;
}
