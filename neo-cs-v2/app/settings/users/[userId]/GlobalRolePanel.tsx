"use client";

// グローバルロール変更パネル
// ボタン式: 各ロールを横並びにし、選択中はハイライト + 即時保存
// 保存時に楽観的更新 → Server Action 完了で revalidatePath が走る

import { useState, useTransition } from "react";
import type { AppUserRole } from "@/lib/repository/types";
import { setUserRole } from "../actions";

const ROLES: { value: AppUserRole; label: string; desc: string; tone: string }[] = [
  {
    value: "admin",
    label: "Admin",
    desc: "全権限・ユーザー管理",
    tone: "border-rose-300 bg-rose-50 text-rose-700"
  },
  {
    value: "manager",
    label: "Manager",
    desc: "担当事業の全体把握",
    tone: "border-purple-300 bg-purple-50 text-purple-700"
  },
  {
    value: "member",
    label: "Member",
    desc: "担当事業の実務",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-700"
  },
  {
    value: "viewer",
    label: "Viewer",
    desc: "閲覧のみ",
    tone: "border-ink-200 bg-ink-50 text-ink-700"
  },
  {
    value: "external",
    label: "External",
    desc: "外部ユーザー（特定企業のみ）",
    tone: "border-amber-300 bg-amber-50 text-amber-700"
  }
];

export function GlobalRolePanel({
  userId,
  currentRole
}: {
  userId: string;
  currentRole: AppUserRole;
}) {
  const [role, setRole] = useState<AppUserRole>(currentRole);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const handleSelect = (next: AppUserRole) => {
    if (next === role) return;
    const prev = role;
    setRole(next); // 楽観的更新
    setMsg(null);
    startTransition(async () => {
      try {
        await setUserRole(userId, next);
        setMsg("更新しました");
      } catch (e) {
        setRole(prev);
        setMsg(`エラー: ${(e as Error).message}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {ROLES.map((r) => {
          const active = role === r.value;
          return (
            <button
              key={r.value}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(r.value)}
              aria-pressed={active}
              className={[
                "rounded-xl border px-3 py-3 text-left transition",
                active
                  ? `${r.tone} ring-2 ring-offset-1 ring-ink-900/10 font-medium`
                  : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50",
                pending ? "opacity-60 cursor-wait" : ""
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{r.label}</div>
              <div className="mt-0.5 text-[11px] opacity-80 leading-tight">
                {r.desc}
              </div>
            </button>
          );
        })}
      </div>
      {msg && <div className="text-xs text-ink-500">{msg}</div>}
    </div>
  );
}
