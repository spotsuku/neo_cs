"use client";

import { useState, useMemo, useTransition } from "react";
import { grantCompanyAccess, revokeCompanyAccess } from "../actions";

export function CompanyAccessPanel({
  userId,
  grantedCompanyIds,
  companies
}: {
  userId: string;
  grantedCompanyIds: string[];
  companies: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const grantedSet = useMemo(() => new Set(grantedCompanyIds), [grantedCompanyIds]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, filter]);

  const toggle = (companyId: string, granted: boolean) => {
    startTransition(async () => {
      try {
        if (granted) {
          await revokeCompanyAccess(userId, companyId);
        } else {
          await grantCompanyAccess({ userId, companyId });
        }
      } catch (e) {
        alert(`エラー: ${(e as Error).message}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="企業名で検索"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-3 py-1.5 rounded-full border border-ink-100 bg-white text-sm"
      />
      <div className="text-xs text-ink-500">
        付与中: {grantedSet.size} 社 / 全 {companies.length} 社
      </div>
      <ul className="max-h-[400px] overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-100">
        {filtered.map((c) => {
          const granted = grantedSet.has(c.id);
          return (
            <li
              key={c.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span className="text-ink-900">{c.name}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(c.id, granted)}
                className={`px-3 py-1 rounded-full text-xs ${
                  granted
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                }`}
              >
                {granted ? "付与中" : "付与"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
