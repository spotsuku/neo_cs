// ユーザー管理（admin 専用）
//
// グローバルロール（admin/manager/member/viewer/external）と
// 事業×スコープロール（viewer/editor/template_editor）を一覧表示する。
// 招待・編集 UI は Server Action 連携後に追加（mock 段階では disabled）。

import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { getPermissionContext } from "@/lib/auth/server";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  userRepo,
  userProgramRoleRepo,
  userCompanyAccessRepo,
  companyRepo
} from "@/lib/repository/server";
import { InviteExternalDialog } from "./InviteExternalDialog";
import { ImpersonateButton } from "./ImpersonateButton";
import type {
  AppUser,
  AppUserRole,
  ProgramScopeRole
} from "@/lib/repository/types";
import { products, productByCode } from "@/lib/mock/data";

const ROLE_STYLE: Record<AppUserRole, { color: string; bg: string; label: string }> = {
  admin: { color: "#6366f1", bg: "#6366f114", label: "Admin" },
  manager: { color: "#8B5CF6", bg: "#8B5CF614", label: "Manager" },
  member: { color: "#10b981", bg: "#10b98114", label: "Member" },
  viewer: { color: "#64748b", bg: "#64748b14", label: "閲覧" },
  external: { color: "#F59E0B", bg: "#F59E0B14", label: "外部" }
};

const SCOPE_LABEL: Record<ProgramScopeRole, string> = {
  viewer: "閲覧",
  editor: "項目編集",
  template_editor: "テンプレ編集"
};

const SCOPE_TONE: Record<ProgramScopeRole, string> = {
  viewer: "bg-ink-50 text-ink-600 border-ink-100",
  editor: "bg-emerald-50 text-emerald-700 border-emerald-100",
  template_editor: "bg-indigo-50 text-indigo-700 border-indigo-100"
};

function initials(name: string) {
  return name.slice(0, 2);
}

export default async function UsersSettingsPage() {
  const ctx = await getPermissionContext();
  if (!canManageUsers(ctx)) {
    redirect("/settings");
  }

  const [allUsers, programRoles, allCompanies] = await Promise.all([
    userRepo.list({ activeOnly: false }),
    userProgramRoleRepo.list(),
    companyRepo.list()
  ]);
  const accessByUser = new Map<string, number>();
  await Promise.all(
    allUsers
      .filter((u) => u.role === "external")
      .map(async (u) => {
        const list = await userCompanyAccessRepo.listByUser(u.id);
        accessByUser.set(u.id, list.length);
      })
  );

  const programRolesByUser = new Map<string, typeof programRoles>();
  for (const r of programRoles) {
    const arr = programRolesByUser.get(r.userId) ?? [];
    arr.push(r);
    programRolesByUser.set(r.userId, arr);
  }

  const internalUsers = allUsers.filter((u) => u.role !== "external");
  const externalUsers = allUsers.filter((u) => u.role === "external");

  const total = allUsers.length;
  const adminCount = allUsers.filter((u) => u.role === "admin").length;
  const externalCount = externalUsers.length;

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[1720px] px-6 py-8 space-y-8">
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">設定</Link>
            <span>/</span>
            <span>ユーザー管理</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">ユーザー管理</h1>
              <div className="mt-1 text-sm text-ink-500">
                グローバルロールと事業×スコープロールを管理（Admin のみ）
              </div>
            </div>
            <button
              type="button"
              disabled
              title="準備中: Supabase Auth admin invite と連動"
              className="px-4 py-2 rounded-full bg-ink-300 text-white text-sm cursor-not-allowed"
            >
              + ユーザー招待（準備中）
            </button>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="合計ユーザー" value={total} sub="アクティブ含む" />
            <Stat label="Admin" value={adminCount} sub="全社編集権限" tone="#6366f1" />
            <Stat label="外部ユーザー" value={externalCount} sub="契約企業のみアクセス" tone="#F59E0B" />
          </div>
        </section>

        {/* 社内ユーザー */}
        <section className="liquid-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink-900">社内ユーザー</h2>
            <span className="text-xs text-ink-500">{internalUsers.length}名</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60 text-ink-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3 w-12"></th>
                  <th className="text-left font-medium px-2 py-3">名前</th>
                  <th className="text-left font-medium px-4 py-3">メール</th>
                  <th className="text-left font-medium px-4 py-3">ロール</th>
                  <th className="text-left font-medium px-4 py-3">担当事業 × スコープ</th>
                  <th className="text-right font-medium px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {internalUsers.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    programRoles={programRolesByUser.get(u.id) ?? []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 外部ユーザー */}
        <section className="liquid-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900">外部ユーザー</h2>
              <div className="text-xs text-ink-500 mt-0.5">
                契約中企業のみ閲覧/進捗編集可。メール+パスワードでログイン
              </div>
            </div>
            <InviteExternalDialog
              companies={allCompanies.map((c) => ({ id: c.id, name: c.name }))}
              products={products.map((p) => ({
                code: p.code,
                name: p.name,
                shortName: p.shortName,
                accent: p.accent
              }))}
            />
          </div>

          {externalUsers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
              外部ユーザーはまだ登録されていません
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-ink-100">
              {externalUsers.map((u) => (
                <li key={u.id} className="py-3 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                    {initials(u.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{u.name}</span>
                      {!u.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-500">
                          無効
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500">{u.email}</div>
                  </div>
                  <div className="text-xs text-ink-700">
                    閲覧可能 {accessByUser.get(u.id) ?? 0} 社
                  </div>
                  <Link
                    href={`/settings/users/${u.id}`}
                    className="text-xs text-ink-700 hover:text-ink-900 ml-2"
                  >
                    編集 →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ロール定義 */}
        <section>
          <h2 className="text-lg font-bold text-ink-900 mb-3">ロール定義</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RoleCard
              role="admin"
              description="NEO 全体の編集・ユーザー管理・全社共通マスタの変更が可能"
              capabilities={["ユーザー追加削除", "全事業のテンプレ編集", "全社マスタ変更", "Manager/Member 表示切替"]}
            />
            <RoleCard
              role="manager"
              description="担当事業の全体把握・横断分析。マネージャー専用画面が表示される"
              capabilities={["事業全体の進捗・アラート閲覧", "契約更新サマリー", "担当事業のスコープ権限に従い編集"]}
            />
            <RoleCard
              role="member"
              description="担当事業内の実務担当。スコープロール（viewer/editor/template_editor）に従う"
              capabilities={["担当事業の進捗更新", "週次入力", "担当社のカルテ編集"]}
            />
            <RoleCard
              role="external"
              description="契約中の特定企業のみ閲覧/進捗編集が可能。横断画面は非表示"
              capabilities={["許可された企業のみ閲覧", "進捗編集", "テンプレ・他社情報は不可"]}
            />
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — ユーザー管理
        </footer>
      </main>
    </>
  );
}

function UserRow({
  user,
  programRoles
}: {
  user: AppUser;
  programRoles: { productCode: string; scopeRole: ProgramScopeRole }[];
}) {
  const style = ROLE_STYLE[user.role];
  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/40">
      <td className="px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-xs font-bold">
          {initials(user.name)}
        </div>
      </td>
      <td className="px-2 py-3 font-medium text-ink-900">{user.name}</td>
      <td className="px-4 py-3 text-ink-700">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ color: style.color, background: style.bg }}
        >
          {style.label}
        </span>
      </td>
      <td className="px-4 py-3">
        {user.role === "admin" ? (
          <span className="text-xs text-ink-500">全事業（暗黙）</span>
        ) : programRoles.length === 0 ? (
          <span className="text-xs text-ink-400">未割当</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {programRoles.map((pr) => {
              const product = productByCode[pr.productCode as keyof typeof productByCode];
              return (
                <span
                  key={pr.productCode}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${SCOPE_TONE[pr.scopeRole]}`}
                >
                  <span className="font-medium">{product?.shortName ?? pr.productCode}</span>
                  <span>·</span>
                  <span>{SCOPE_LABEL[pr.scopeRole]}</span>
                </span>
              );
            })}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-3">
          <ImpersonateButton userId={user.id} userRole={user.role} userName={user.name} />
          <Link
            href={`/settings/users/${user.id}`}
            className="text-xs text-ink-700 hover:text-ink-900"
          >
            編集
          </Link>
        </div>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="liquid-surface p-6">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-2 text-3xl font-bold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

function RoleCard({
  role,
  description,
  capabilities
}: {
  role: AppUserRole;
  description: string;
  capabilities: string[];
}) {
  const s = ROLE_STYLE[role];
  return (
    <div className="liquid-surface p-6">
      <span
        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ color: s.color, background: s.bg }}
      >
        {s.label}
      </span>
      <div className="mt-3 text-sm text-ink-700 leading-relaxed">{description}</div>
      <ul className="mt-4 space-y-1.5">
        {capabilities.map((c) => (
          <li key={c} className="text-xs text-ink-700 flex items-start gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ background: s.color }}
            />
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
