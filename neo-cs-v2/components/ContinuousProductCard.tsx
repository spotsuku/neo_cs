// コース表示に対応
import Link from "next/link";
import {
  continuousSummary,
  health,
  productByCode,
  ProductCode,
  yen,
  pct,
  nrrFormat,
  hasMultipleCourses,
  productCourses,
  courseShortName
} from "@/lib/mock/data";
import { activeContracts } from "@/lib/mock/onboarding";
import { HealthDistribution } from "./HealthDistribution";

export function ContinuousProductCard({ code }: { code: "academia" | "hyogikai" | "commu" }) {
  const p = productByCode[code as ProductCode];
  const s = continuousSummary[code];
  const h = health.byProduct[code];

  // 新しい activeContracts から集計
  const productContracts = activeContracts.filter((c) => c.product === code);
  const contractCount = productContracts.length;
  const participantSum = productContracts.reduce((acc, c) => acc + c.participants, 0);
  const mrrSum = productContracts.reduce((acc, c) => acc + (c.mrr ?? 0), 0);

  return (
    <Link href={`/dashboard/${code}`} className="liquid-surface p-5 text-left relative overflow-hidden hover:shadow-liquid-lg transition group block">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: p.accent }} />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-ink-500 font-medium uppercase tracking-wider">継続型</div>
          <div className="mt-0.5 text-base font-bold tracking-tight">{p.shortName}</div>
          <div className="text-[11px] text-ink-500">{p.name}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <div className="text-[10px] text-ink-500">アクティブ契約</div>
          <div className="text-lg font-bold">{contractCount} <span className="text-xs font-normal text-ink-500">件</span></div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">アクティブ参加者</div>
          <div className="text-lg font-bold">{participantSum} <span className="text-xs font-normal text-ink-500">名</span></div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">MRR</div>
          <div className="text-lg font-bold">{yen(mrrSum)}</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">NRR</div>
          <div className="text-lg font-bold">
            {nrrFormat(s.nrr)}
            <span className={`ml-1 text-[10px] font-medium ${s.nrr >= 1 ? "text-emerald-600" : "text-rose-500"}`}>
              {s.nrr >= 1 ? "▲" : "▼"}
            </span>
          </div>
        </div>
      </div>

      {/* コース構成（複数コース研修のみ） */}
      {hasMultipleCourses(code) && (
        <div className="mt-3 pt-3 border-t border-ink-100">
          <div className="text-[10px] text-ink-500 mb-1">コース構成</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
            {productCourses[code].map((course) => {
              const n = productContracts.filter((c) => c.courseKey === course.key).length;
              return (
                <span key={course.key} className="text-ink-700">
                  <span className="font-medium">{courseShortName(code, course.key)}</span>
                  <span className="ml-1 text-ink-900 font-semibold">{n}</span>
                  <span className="text-ink-500">社</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-ink-100">
        <div className="text-[10px] text-ink-500 mb-1.5">Customer Health</div>
        <HealthDistribution green={h.green} yellow={h.yellow} red={h.red} size="sm" />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-ink-500">
          出席 <span className="text-ink-700 font-medium">{pct(s.attendance)}</span>
          <span className="mx-1.5 text-ink-300">·</span>
          NPS <span className="text-ink-700 font-medium">{s.nps}</span>
        </span>
        <span className="text-ink-700 font-medium">
          今後90日更新 {s.upcomingRenewals}件
        </span>
      </div>
    </Link>
  );
}
