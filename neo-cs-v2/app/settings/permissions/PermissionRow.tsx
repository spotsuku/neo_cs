"use client";

import { useState, useTransition } from "react";
import { updateRolePermissionAction } from "./actions";
import { ROLE_LABEL } from "@/lib/auth/permission-keys";
import type { AppUserRole, PermissionKey } from "@/lib/repository/types";

const SELECTABLE_ROLES: AppUserRole[] = ["admin", "manager", "member", "viewer"];

export function PermissionRow({
  permissionKey,
  label,
  description,
  initialMinRole,
  updatedAt
}: {
  permissionKey: PermissionKey;
  label: string;
  description: string | null;
  initialMinRole: AppUserRole;
  updatedAt: string | null;
}) {
  const [minRole, setMinRole] = useState<AppUserRole>(initialMinRole);
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onChange = (next: AppUserRole) => {
    if (next === minRole) return;
    const prev = minRole;
    setMinRole(next);
    setError(null);
    start(async () => {
      const r = await updateRolePermissionAction({
        permissionKey,
        minRole: next
      });
      if (!r.ok) {
        setError(r.message);
        setMinRole(prev); // ロールバック
        return;
      }
      setSavedAt(new Date().toISOString());
    });
  };

  return (
    <tr className="border-b border-ink-50 last:border-0">
      <td className="px-4 py-3 align-top">
        <div className="text-sm text-ink-900 font-medium">{label}</div>
        {description && <div className="text-[11px] text-ink-500 mt-0.5">{description}</div>}
      </td>
      <td className="px-4 py-3 align-top">
        <select
          value={minRole}
          onChange={(e) => onChange(e.target.value as AppUserRole)}
          disabled={pending}
          className="w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
        >
          {SELECTABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]} 以上
            </option>
          ))}
        </select>
        {error && <div className="text-[11px] text-rose-600 mt-1">{error}</div>}
        {pending && <div className="text-[11px] text-ink-500 mt-1">保存中…</div>}
      </td>
      <td className="px-4 py-3 align-top text-[11px] text-ink-500">
        {savedAt ? new Date(savedAt).toLocaleString("ja-JP") : "—"}
      </td>
    </tr>
  );
}
