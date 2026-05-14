"use client";

// 社内ユーザー招待モーダル
// メール + 表示名 + グローバルロール を入力し、app_users に事前登録する。
// auth_user_id は未設定のまま — 当該ユーザーが Google でログインしたとき
// middleware が email マッチで auth_user_id を後付けリンクする。

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppUserRole } from "@/lib/repository/types";
import { inviteInternalUser } from "./actions";

type InvitableRole = Exclude<AppUserRole, "external">;

const ROLE_OPTIONS: { value: InvitableRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "全社編集 / ユーザー管理" },
  { value: "manager", label: "Manager", description: "担当事業の全体把握・横断分析" },
  { value: "member", label: "Member", description: "担当事業内の実務担当" },
  { value: "viewer", label: "Viewer", description: "閲覧のみ" }
];

export function InviteInternalDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<InvitableRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setEmail("");
    setName("");
    setRole("member");
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!email.trim() || !name.trim()) {
      setError("メール / 表示名を入力してください");
      return;
    }
    startTransition(async () => {
      try {
        await inviteInternalUser({ email: email.trim(), name: name.trim(), role });
        close();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-full bg-ink-900 text-white text-sm hover:bg-ink-800"
      >
        + ユーザー招待
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col">
            <header className="px-6 py-4 border-b border-ink-100">
              <h3 className="text-lg font-semibold text-ink-900">ユーザー招待</h3>
              <p className="text-xs text-ink-500 mt-0.5">
                メールアドレスを事前登録します。同じメールで Google ログインしたときに自動でリンクされます
              </p>
            </header>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-ink-500 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm"
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  Google アカウントのメールアドレスと一致させてください
                </p>
              </div>

              <div>
                <label className="block text-xs text-ink-500 mb-1">表示名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-500 mb-2">ロール</label>
                <div className="space-y-1.5">
                  {ROLE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer ${
                        role === opt.value
                          ? "border-ink-900 bg-ink-50"
                          : "border-ink-100 hover:bg-ink-50/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={opt.value}
                        checked={role === opt.value}
                        onChange={() => setRole(opt.value)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-ink-900">{opt.label}</div>
                        <div className="text-[11px] text-ink-500">{opt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  招待後、ユーザー詳細画面で担当事業のスコープロールを設定できます
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <footer className="px-6 py-4 border-t border-ink-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="px-4 py-1.5 rounded-full border border-ink-100 text-sm text-ink-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="px-4 py-1.5 rounded-full bg-ink-900 text-white text-sm disabled:bg-ink-300"
              >
                {pending ? "登録中..." : "招待して登録"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
