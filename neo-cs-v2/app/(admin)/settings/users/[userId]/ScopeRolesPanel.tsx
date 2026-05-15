"use client";

// 担当事業×スコープロールパネル
// 事業ごとに 4 ボタン（未割当 / 閲覧 / 項目編集 / テンプレ編集）を表示
// クリックで即時保存（楽観的更新）

import { useState, useTransition } from "react";
import { products } from "@/lib/master";
import type { ProgramScopeRole } from "@/lib/repository/types";
import { upsertProgramScopeRole, removeProgramScopeRole } from "../actions";

type ScopeChoice = ProgramScopeRole | "none";

const CHOICES: { value: ScopeChoice; label: string; tone: string }[] = [
  { value: "none", label: "未割当", tone: "border-ink-100 text-ink-500" },
  { value: "viewer", label: "閲覧", tone: "border-ink-200 bg-ink-50 text-ink-700" },
  {
    value: "editor",
    label: "項目編集",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-700"
  },
  {
    value: "template_editor",
    label: "テンプレ編集",
    tone: "border-indigo-300 bg-indigo-50 text-indigo-700"
  }
];

export function ScopeRolesPanel({
  userId,
  programRoles
}: {
  userId: string;
  programRoles: { productCode: string; scopeRole: ProgramScopeRole }[];
}) {
  const initial = new Map<string, ScopeChoice>();
  for (const p of products) initial.set(p.code, "none");
  for (const r of programRoles) initial.set(r.productCode, r.scopeRole);
  const [state, setState] = useState<Map<string, ScopeChoice>>(initial);
  const [pendingProduct, setPendingProduct] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSelect = (productCode: string, value: ScopeChoice) => {
    const current = state.get(productCode);
    if (current === value) return;
    const prev = current ?? "none";
    setState((m) => {
      const next = new Map(m);
      next.set(productCode, value);
      return next;
    });
    setPendingProduct(productCode);
    startTransition(async () => {
      try {
        if (value === "none") {
          await removeProgramScopeRole(userId, productCode);
        } else {
          await upsertProgramScopeRole({ userId, productCode, scopeRole: value });
        }
      } catch (e) {
        // ロールバック
        setState((m) => {
          const next = new Map(m);
          next.set(productCode, prev);
          return next;
        });
        alert(`エラー: ${(e as Error).message}`);
      } finally {
        setPendingProduct(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {products.map((p) => {
        const current = state.get(p.code) ?? "none";
        const isPending = pendingProduct === p.code;
        return (
          <div key={p.code} className="rounded-xl border border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: p.accent }}
              />
              <span className="text-sm font-medium text-ink-900">{p.name}</span>
              {isPending && (
                <span className="ml-2 text-[10px] text-ink-500">保存中...</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHOICES.map((c) => {
                const active = current === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => handleSelect(p.code, c.value)}
                    disabled={isPending}
                    aria-pressed={active}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? `${c.tone} font-medium`
                        : "border-ink-100 bg-white text-ink-500 hover:bg-ink-50",
                      isPending ? "opacity-60 cursor-wait" : ""
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
