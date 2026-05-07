import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { rolePermissionRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";
import { PERMISSION_LABELS, ROLE_LABEL } from "@/lib/auth/permission-keys";
import { PermissionRow } from "./PermissionRow";
import type { PermissionKey } from "@/lib/repository/types";

export const dynamic = "force-dynamic";

export default async function PermissionsSettingsPage() {
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) redirect("/?forbidden=1");

  const all = await rolePermissionRepo.list();
  // 表示順を固定 (PERMISSION_LABELS の宣言順)
  const KEYS: PermissionKey[] = ["contract_manage", "program_term_manage"];
  const rows = KEYS.map((k) => {
    const r = all.find((x) => x.permissionKey === k);
    return {
      permissionKey: k,
      minRole: r?.minRole ?? "manager",
      description: r?.description ?? null,
      updatedAt: r?.updatedAt ?? null
    };
  });

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[900px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <Link href="/settings" className="hover:text-ink-700">
              設定
            </Link>
            <span className="mx-1">/</span>
            <span>機能権限</span>
          </div>
          <h1 className="text-xl font-bold text-ink-900">機能権限</h1>
          <p className="text-sm text-ink-500">
            各機能を実行できる「最低ロール」を設定します。例: 契約管理を{" "}
            <code>member</code> 以上に下げれば現場メンバーも契約 CRUD が可能になります。
          </p>
          <p className="text-[11px] text-ink-500">
            外部 (<code>external</code>) ユーザーは常に対象外です。
            変更は audit_logs に記録されます。
          </p>
        </header>

        <section className="liquid-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
                <th className="px-4 py-3 font-medium">機能</th>
                <th className="px-4 py-3 font-medium w-56">最低ロール</th>
                <th className="px-4 py-3 font-medium w-40">最終更新</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PermissionRow
                  key={r.permissionKey}
                  permissionKey={r.permissionKey}
                  label={PERMISSION_LABELS[r.permissionKey]}
                  description={r.description}
                  initialMinRole={r.minRole}
                  updatedAt={r.updatedAt}
                />
              ))}
            </tbody>
          </table>
        </section>

        <section className="liquid-surface p-4 text-xs text-ink-500 space-y-1">
          <div className="text-ink-700 font-medium">ロールの強さ (上位ほど許可範囲大)</div>
          <div>
            {[
              "admin",
              "manager",
              "member",
              "viewer"
            ]
              .map((r) => ROLE_LABEL[r as keyof typeof ROLE_LABEL])
              .join(" ＞ ")}
          </div>
        </section>
      </main>
    </>
  );
}
