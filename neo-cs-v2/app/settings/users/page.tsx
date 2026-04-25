import Link from "next/link";
import { TopNav } from "@/components/TopNav";

type Role = "Admin" | "CS" | "閲覧";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedCount: number;
  lastLogin: string;
  color: string;
};

const users: User[] = [
  {
    id: "u01",
    name: "古野 健太",
    email: "k.furuno@neoacademia.jp",
    role: "Admin",
    assignedCount: 12,
    lastLogin: "2026-04-25 09:12",
    color: "#6366f1",
  },
  {
    id: "u02",
    name: "佐藤 由香",
    email: "y.sato@neoacademia.jp",
    role: "CS",
    assignedCount: 18,
    lastLogin: "2026-04-25 08:40",
    color: "#10b981",
  },
  {
    id: "u03",
    name: "田中 拓也",
    email: "t.tanaka@neoacademia.jp",
    role: "CS",
    assignedCount: 15,
    lastLogin: "2026-04-24 19:05",
    color: "#f59e0b",
  },
  {
    id: "u04",
    name: "鈴木 美咲",
    email: "m.suzuki@neoacademia.jp",
    role: "CS",
    assignedCount: 9,
    lastLogin: "2026-04-24 17:22",
    color: "#ec4899",
  },
  {
    id: "u05",
    name: "高橋 翔太",
    email: "s.takahashi@neoacademia.jp",
    role: "Admin",
    assignedCount: 7,
    lastLogin: "2026-04-23 11:48",
    color: "#0ea5e9",
  },
  {
    id: "u06",
    name: "山本 彩花",
    email: "a.yamamoto@neoacademia.jp",
    role: "CS",
    assignedCount: 14,
    lastLogin: "2026-04-22 16:10",
    color: "#a855f7",
  },
  {
    id: "u07",
    name: "中村 健介",
    email: "k.nakamura@neoacademia.jp",
    role: "閲覧",
    assignedCount: 0,
    lastLogin: "2026-04-20 10:33",
    color: "#64748b",
  },
  {
    id: "u08",
    name: "伊藤 真由美",
    email: "m.ito@neoacademia.jp",
    role: "閲覧",
    assignedCount: 0,
    lastLogin: "2026-04-15 14:55",
    color: "#94a3b8",
  },
  {
    id: "u09",
    name: "小林 大輔",
    email: "d.kobayashi@neoacademia.jp",
    role: "CS",
    assignedCount: 11,
    lastLogin: "2026-04-25 07:58",
    color: "#ef4444",
  },
  {
    id: "u10",
    name: "渡辺 さくら",
    email: "s.watanabe@neoacademia.jp",
    role: "CS",
    assignedCount: 13,
    lastLogin: "2026-04-24 21:14",
    color: "#14b8a6",
  },
];

const roleStyle: Record<Role, { color: string; bg: string; label: string }> = {
  Admin: { color: "#6366f1", bg: "#6366f114", label: "Admin" },
  CS: { color: "#10b981", bg: "#10b98114", label: "CS担当" },
  閲覧: { color: "#64748b", bg: "#64748b14", label: "閲覧のみ" },
};

const roles: { name: Role; description: string; capabilities: string[] }[] = [
  {
    name: "Admin",
    description: "全機能へのアクセス・ユーザー管理・マスタ設定が可能",
    capabilities: ["ユーザー管理", "研修マスタ編集", "全社データ閲覧・編集"],
  },
  {
    name: "CS",
    description: "担当企業のカルテ管理・週次レビュー・契約更新の起票が可能",
    capabilities: ["担当企業の編集", "週次レビュー入力", "更新提案の起票"],
  },
  {
    name: "閲覧",
    description: "全データの閲覧のみ可能。編集・削除は不可",
    capabilities: ["全社データ閲覧", "レポート出力"],
  },
];

function initials(name: string) {
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2);
}

export default function UsersSettingsPage() {
  const total = users.length;
  const adminCount = users.filter((u) => u.role === "Admin").length;
  const activeCount = users.filter((u) => u.lastLogin >= "2026-03-26").length;

  return (
    <>
      <TopNav current="/settings" />
      <main className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
        <section>
          <div className="flex items-center gap-2 text-xs text-ink-500 font-medium">
            <Link href="/settings" className="hover:text-ink-700">設定</Link>
            <span>/</span>
            <span>ユーザー管理</span>
          </div>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">ユーザー管理</h1>
              <div className="mt-1 text-sm text-ink-500">
                CS担当者・管理者・閲覧ユーザーの追加と権限ロールを設定
              </div>
            </div>
            <button className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-700 shadow-liquid">
              + ユーザーを追加
            </button>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="liquid-surface p-6">
              <div className="text-xs text-ink-500">合計ユーザー数</div>
              <div className="mt-2 text-3xl font-bold text-ink-900">{total}</div>
              <div className="mt-1 text-[11px] text-ink-500">アクティブアカウント</div>
            </div>
            <div className="liquid-surface p-6">
              <div className="text-xs text-ink-500">Admin数</div>
              <div className="mt-2 text-3xl font-bold" style={{ color: "#6366f1" }}>{adminCount}</div>
              <div className="mt-1 text-[11px] text-ink-500">マスタ編集権限保有</div>
            </div>
            <div className="liquid-surface p-6">
              <div className="text-xs text-ink-500">直近30日アクティブ数</div>
              <div className="mt-2 text-3xl font-bold" style={{ color: "#10b981" }}>{activeCount}</div>
              <div className="mt-1 text-[11px] text-ink-500">過去30日以内にログイン</div>
            </div>
          </div>
        </section>

        <section className="liquid-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink-900">ユーザー一覧</h2>
              <div className="text-xs text-ink-500 mt-0.5">{total}名のユーザーが登録されています</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <input
                type="search"
                placeholder="名前・メールで検索"
                className="px-3 py-1.5 rounded-full border border-ink-100 bg-white/60 text-ink-700 placeholder:text-ink-500 focus:outline-none focus:border-ink-700 w-56"
              />
              <select className="px-3 py-1.5 rounded-full border border-ink-100 bg-white/60 text-ink-700">
                <option>全ロール</option>
                <option>Admin</option>
                <option>CS担当</option>
                <option>閲覧のみ</option>
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-50/60 text-ink-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-3 w-12"></th>
                  <th className="text-left font-medium px-2 py-3">名前</th>
                  <th className="text-left font-medium px-4 py-3">メール</th>
                  <th className="text-left font-medium px-4 py-3">ロール</th>
                  <th className="text-right font-medium px-4 py-3">担当社数</th>
                  <th className="text-left font-medium px-4 py-3">最終ログイン</th>
                  <th className="text-right font-medium px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const r = roleStyle[u.role];
                  return (
                    <tr key={u.id} className="border-t border-ink-100 hover:bg-ink-50/40">
                      <td className="px-4 py-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: u.color }}
                        >
                          {initials(u.name)}
                        </div>
                      </td>
                      <td className="px-2 py-3 font-medium text-ink-900">{u.name}</td>
                      <td className="px-4 py-3 text-ink-700">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ color: r.color, background: r.bg }}
                        >
                          {r.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-700 font-medium tabular-nums">
                        {u.assignedCount > 0 ? `${u.assignedCount}社` : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-700 tabular-nums">{u.lastLogin}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href="#" className="text-xs text-ink-700 hover:text-ink-900 mr-3">
                          編集
                        </Link>
                        <Link href="#" className="text-xs text-rose-600 hover:text-rose-700">
                          削除
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">ロール一覧</h2>
              <div className="text-xs text-ink-500 mt-0.5">3種類のロールに権限が紐づいています</div>
            </div>
            <Link href="#" className="text-xs text-ink-700 hover:text-ink-900">
              権限定義を編集 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((r) => {
              const s = roleStyle[r.name];
              return (
                <div key={r.name} className="liquid-surface p-6">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: s.color, background: s.bg }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-ink-700 leading-relaxed">{r.description}</div>
                  <ul className="mt-4 space-y-1.5">
                    {r.capabilities.map((c) => (
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
            })}
          </div>
        </section>

        <footer className="pt-8 pb-4 text-center text-[11px] text-ink-500">
          NEO CS v2 — ユーザー管理 / ダミーデータ
        </footer>
      </main>
    </>
  );
}
