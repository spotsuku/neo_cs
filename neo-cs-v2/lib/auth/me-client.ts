// /api/me のクライアント側キャッシュ
//
// TopNav 等が複数回マウントされても fetch が 1 回で済むように、モジュール
// スコープにレスポンスをキャッシュする。表示モード切替や route 遷移後の
// invalidate は invalidateMe() を呼ぶ。

export type MeResponse = {
  user: { id: string; name: string; email: string; role: string } | null;
  viewModeOverride: "manager" | "member" | null;
  effectiveRole: string;
  assignedProductCodes: string[];
};

const TTL_MS = 60_000; // 1 分

let cached: { ts: number; data: MeResponse } | null = null;
let inflight: Promise<MeResponse | null> | null = null;

export function invalidateMe(): void {
  cached = null;
  inflight = null;
}

export async function fetchMe(): Promise<MeResponse | null> {
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) return cached.data;
  if (inflight) return inflight;

  inflight = fetch("/api/me", { cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) return null;
      const data = (await r.json()) as MeResponse;
      cached = { ts: Date.now(), data };
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
