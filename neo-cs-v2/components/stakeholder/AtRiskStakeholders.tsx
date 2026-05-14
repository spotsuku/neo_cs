// at_risk な顧客側担当者 トップ N (Server Component)
//
// 全 stakeholders を engagement_tier_overridden 値、もしくは
// meeting_logs から自動算出した tier で評価し、at_risk のみを抽出して
// 「最終接点が古い順」に並べる。ダッシュボード (/) に配置する。

import Link from "next/link";
import { stakeholderRepo, meetingLogRepo, companyRepo } from "@/lib/repository/server";
import { computeStakeholderEngagement } from "@/lib/domain/engagement-builder";
import { EngagementBadge } from "./StakeholderEngagementCard";
import { stakeholderTypeLabel } from "@/lib/mock/cycles";

export async function AtRiskStakeholders({ limit = 5 }: { limit?: number }) {
  const [stakeholders, companies] = await Promise.all([
    stakeholderRepo.list(),
    companyRepo.list()
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // company 単位で meeting_logs を 1 度だけ取得 (N+1 を最小化)
  const companyIds = Array.from(new Set(stakeholders.map((s) => s.companyId)));
  const meetingsByCompany = new Map<string, Awaited<ReturnType<typeof meetingLogRepo.listByCompany>>>();
  await Promise.all(
    companyIds.map(async (cid) => {
      const ms = await meetingLogRepo.listByCompany(cid, { sort: "date desc", limit: 50 });
      meetingsByCompany.set(cid, ms);
    })
  );

  type Row = {
    id: string;
    name: string;
    role: string;
    type: (typeof stakeholders)[number]["type"];
    companyId: string;
    companyName: string;
    lastTouchAt: string | null;
    touchCount30d: number;
    touchCount90d: number;
    overridden: boolean;
  };

  const rows: Row[] = [];
  for (const s of stakeholders) {
    const meetings = meetingsByCompany.get(s.companyId) ?? [];
    const r = computeStakeholderEngagement(s, { meetingLogs: meetings });
    if (r.tier !== "at_risk") continue;
    const c = companyById.get(s.companyId);
    rows.push({
      id: s.id,
      name: s.name,
      role: s.role,
      type: s.type,
      companyId: s.companyId,
      companyName: c?.name ?? s.companyId,
      lastTouchAt: r.lastTouchAt,
      touchCount30d: r.touchCount30d,
      touchCount90d: r.touchCount90d,
      overridden: r.tier !== r.suggestedTier
    });
  }

  // 最終接点が古い順 (null は最も古い扱い)
  rows.sort((a, b) => {
    const av = a.lastTouchAt ?? "0000-00-00";
    const bv = b.lastTouchAt ?? "0000-00-00";
    return av.localeCompare(bv);
  });

  const top = rows.slice(0, limit);

  return (
    <div className="liquid-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-ink-900">at_risk な顧客側担当者</div>
        <span className="text-[11px] text-ink-500">最終接点が古い順 / 全{rows.length}件</span>
      </div>
      {top.length === 0 ? (
        <div className="text-sm text-ink-500 py-6 text-center">該当者はいません</div>
      ) : (
        <ul className="space-y-2">
          {top.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2 bg-white"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/companies/${r.companyId}`}
                    className="text-sm font-semibold text-ink-900 hover:underline truncate"
                  >
                    {r.name}
                  </Link>
                  <span className="text-[10px] text-ink-500">{stakeholderTypeLabel[r.type]}</span>
                </div>
                <div className="text-[11px] text-ink-500 truncate">
                  {r.companyName} / {r.role}
                </div>
              </div>
              <div className="text-right shrink-0">
                <EngagementBadge tier="at_risk" />
                <div className="text-[10px] text-ink-500 mt-0.5">
                  最終接点 {r.lastTouchAt ?? "—"}
                </div>
                {r.overridden && (
                  <div className="text-[10px] text-ink-400">手動指定</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
