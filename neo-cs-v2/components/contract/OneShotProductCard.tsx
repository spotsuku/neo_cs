// コース表示に対応
import Link from "next/link";
import {
  productByCode,
  hasMultipleCourses,
  productCourses,
  courseShortName
} from "@/lib/master";
import type { Contract } from "@/lib/repository/types";

export function OneShotProductCard({
  code,
  activeContracts
}: {
  code: "aiken";
  activeContracts: Contract[];
}) {
  const p = productByCode[code];

  // activeContractsベースで契約数・参加者を集計
  const productContracts = activeContracts.filter((c) => c.product === code);
  const contractCount = productContracts.length;
  const participantSum = productContracts.reduce((acc, c) => acc + c.participants, 0);

  return (
    <Link href={`/dashboard/${code}`} className="liquid-surface p-5 text-left relative overflow-hidden hover:shadow-liquid-lg transition group block">
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: p.accent }} />

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-ink-500 font-medium uppercase tracking-wider">単発型</div>
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
          <div className="text-[10px] text-ink-500">現在受講中</div>
          <div className="text-lg font-bold">{participantSum} <span className="text-xs font-normal text-ink-500">名</span></div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">今年度GMV</div>
          <div className="text-lg font-bold text-ink-300">—</div>
          <div className="text-[10px] text-ink-400">データがまだありません</div>
        </div>
        <div>
          <div className="text-[10px] text-ink-500">今年度修了者</div>
          <div className="text-lg font-bold text-ink-300">—</div>
          <div className="text-[10px] text-ink-400">データがまだありません</div>
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
        <div className="text-[11px] text-ink-400">
          修了率・リピート率・NPS・次回開講 データがまだありません
        </div>
      </div>
    </Link>
  );
}
