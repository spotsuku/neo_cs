"use client";

import { useMemo, useState } from "react";
import type {
  ContractOnboardingItem,
  OnboardingCategory
} from "@/lib/mock/onboarding";

export function ChecklistView({
  template,
  items,
  accent
}: {
  template: OnboardingCategory[];
  items: ContractOnboardingItem[];
  accent: string;
}) {
  // チェック状態はローカルで管理（UIのみ・保存しない）
  const initialChecked = useMemo(() => {
    const m: Record<string, boolean> = {};
    items.forEach((i) => {
      m[i.id] = i.status === "done";
    });
    return m;
  }, [items]);

  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(template.map((c) => [c.key, true]))
  );

  const toggleCheck = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleCat = (key: string) =>
    setOpenCats((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      {template
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((cat) => {
          const catItems = items.filter((i) => i.categoryKey === cat.key);
          const done = catItems.filter(
            (i) => (checked[i.id] ?? false) || i.status === "done"
          ).length;
          const total = catItems.length;
          const isOpen = openCats[cat.key] ?? true;
          return (
            <section key={cat.key} className="liquid-surface overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCat(cat.key)}
                className="w-full p-4 flex items-center gap-4 hover:bg-ink-50/50 text-left"
              >
                <div className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                  <span className="text-ink-500 text-xs">
                    {isOpen ? "▼" : "▶"}
                  </span>
                  {cat.label}
                </div>
                <span className="text-xs text-ink-500">
                  {done}/{total}
                </span>
                <div className="flex-1 max-w-xs ml-4">
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${total > 0 ? (done / total) * 100 : 0}%`,
                        background: accent
                      }}
                    />
                  </div>
                </div>
              </button>

              {isOpen && (
                <ul className="border-t border-ink-100 divide-y divide-ink-50">
                  {catItems.map((it) => {
                    const isChecked = checked[it.id] ?? false;
                    const isOverdue = it.status === "overdue" && !isChecked;
                    return (
                      <li
                        key={it.id}
                        className="px-4 py-3 flex items-start gap-3 hover:bg-ink-50/30"
                      >
                        <button
                          type="button"
                          onClick={() => toggleCheck(it.id)}
                          aria-label="チェック切替"
                          className={[
                            "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center text-xs shrink-0 transition",
                            isChecked
                              ? "text-white border-transparent"
                              : "bg-white border-ink-300 hover:border-ink-500"
                          ].join(" ")}
                          style={
                            isChecked
                              ? { background: accent }
                              : undefined
                          }
                        >
                          {isChecked && "✓"}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "text-sm",
                                isChecked
                                  ? "text-ink-500 line-through"
                                  : "text-ink-900 font-medium"
                              ].join(" ")}
                            >
                              {it.name}
                            </span>
                            {it.required ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                                必須
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-500 border border-ink-100">
                                任意
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                            <span
                              className={
                                isOverdue
                                  ? "text-rose-500 font-medium"
                                  : "text-ink-500"
                              }
                            >
                              期日 {it.dueDate.slice(5).replace("-", "/")}
                            </span>
                            <span className="text-ink-500">
                              担当{" "}
                              <span className="text-ink-700">
                                {it.assignee}
                              </span>
                            </span>
                            {isChecked && it.completedAt && (
                              <span className="text-emerald-600">
                                完了日{" "}
                                {it.completedAt.slice(5).replace("-", "/")}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-rose-500 font-medium">
                                期日超過
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {catItems.length === 0 && (
                    <li className="px-4 py-6 text-xs text-center text-ink-500">
                      項目なし
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
    </div>
  );
}
