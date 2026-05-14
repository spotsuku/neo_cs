import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { userRepo, userProgramRoleRepo, userCompanyAccessRepo, companyRepo } from "@/lib/repository/server";
import { DisableUserPanel } from "./DisableUserPanel";
import { ScopeRolesPanel } from "./ScopeRolesPanel";
import { CompanyAccessPanel } from "./CompanyAccessPanel";
import { GlobalRolePanel } from "./GlobalRolePanel";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧",
  external: "外部"
};

export default async function UserDetailPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [user, current, programRoles, companyAccess, allCompanies] = await Promise.all([
    userRepo.getById(userId),
    userRepo.getCurrent(),
    userProgramRoleRepo.listByUser(userId),
    userCompanyAccessRepo.listByUser(userId),
    companyRepo.list()
  ]);
  if (!user) return notFound();

  const isSelf = current?.id === user.id;
  const canManage = current?.role === "admin";

  return (
    <>
      <TopNavServer current="/settings" />
      <main className="mx-auto max-w-[800px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-caption text-neutral-500">
            <Link href="/settings" className="hover:text-neutral-700">
              設定
            </Link>
            <span className="mx-1">/</span>
            <Link href="/settings/users" className="hover:text-neutral-700">
              ユーザー管理
            </Link>
            <span className="mx-1">/</span>
            <span>{user.name}</span>
          </div>
          <h1 className="text-xl font-bold text-neutral-900">{user.name}</h1>
          <p className="text-body text-neutral-500">{user.email}</p>
        </header>

        <section className="surface p-5 space-y-3">
          <h2 className="text-h4 font-semibold text-neutral-900">基本情報</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-body">
            <dt className="text-neutral-500">ロール</dt>
            <dd>{ROLE_LABEL[user.role] ?? user.role}</dd>
            <dt className="text-neutral-500">作成日</dt>
            <dd>{user.createdAt.slice(0, 10)}</dd>
            <dt className="text-neutral-500">最終ログイン</dt>
            <dd>{user.lastSeenAt ? user.lastSeenAt.slice(0, 16).replace("T", " ") : "—"}</dd>
            <dt className="text-neutral-500">無効化日時</dt>
            <dd>
              {user.disabledAt ? user.disabledAt.slice(0, 16).replace("T", " ") : "—"}
            </dd>
          </dl>
        </section>

        <section className="surface p-5 space-y-4">
          <div>
            <h2 className="text-h4 font-semibold text-neutral-900">アクセス管理</h2>
            <p className="text-caption text-neutral-500 mt-1">
              退職・契約終了時はここで無効化し、合わせて担当顧客の引継ぎを実施してください。手順は{" "}
              <a href="/runbook/04_user_offboarding" className="underline text-info-700">
                docs/runbook/04_user_offboarding.md
              </a>{" "}
              を参照。
            </p>
          </div>
          <DisableUserPanel
            userId={user.id}
            userName={user.name}
            userEmail={user.email}
            isActive={user.isActive}
            isSelf={isSelf}
            canManage={canManage}
          />
        </section>

        {canManage && !isSelf && (
          <section className="surface p-5 space-y-4">
            <h2 className="text-h4 font-semibold text-neutral-900">グローバルロール</h2>
            <GlobalRolePanel userId={user.id} currentRole={user.role} />
          </section>
        )}

        {canManage && user.role !== "admin" && user.role !== "external" && (
          <section className="surface p-5 space-y-4">
            <h2 className="text-h4 font-semibold text-neutral-900">担当事業 × スコープロール</h2>
            <p className="text-caption text-neutral-500">
              事業ごとに編集権限の範囲を設定します（admin は暗黙的に全事業 template_editor 相当）
            </p>
            <ScopeRolesPanel
              userId={user.id}
              programRoles={programRoles.map((r) => ({
                productCode: r.productCode,
                scopeRole: r.scopeRole
              }))}
            />
          </section>
        )}

        {canManage && user.role === "external" && (
          <section className="surface p-5 space-y-4">
            <h2 className="text-h4 font-semibold text-neutral-900">閲覧可能企業</h2>
            <p className="text-caption text-neutral-500">
              この外部ユーザーがアクセスできる企業を指定します
            </p>
            <CompanyAccessPanel
              userId={user.id}
              grantedCompanyIds={companyAccess.map((a) => a.companyId)}
              companies={allCompanies.map((c) => ({ id: c.id, name: c.name }))}
            />
          </section>
        )}
      </main>
    </>
  );
}
