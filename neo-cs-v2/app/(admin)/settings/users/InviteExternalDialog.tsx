"use client";

// 外部ユーザー招待モーダル
// 「企業別」と「事業別」をタブで切替。
//   - 企業別: 個別の company を複数選択
//   - 事業別: productCode を複数選択 → API 側で active 契約の company を解決して付与
// /api/admin/invite-external を呼び出し、Supabase Auth invite + user_company_access を一括設定

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Company = { id: string; name: string };
type Product = { code: string; name: string; shortName: string; accent: string };

type Mode = "by_company" | "by_program";

export function InviteExternalDialog({
  companies,
  products
}: {
  companies: Company[];
  products: Product[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("by_company");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredCompanies = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, filter]);

  const close = () => {
    setOpen(false);
    setEmail("");
    setName("");
    setFilter("");
    setSelectedCompanies(new Set());
    setSelectedProducts(new Set());
    setMode("by_company");
    setError(null);
  };

  const toggleCompany = (id: string) => {
    setSelectedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleProduct = (code: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const submit = () => {
    setError(null);
    if (!email.trim() || !name.trim()) {
      setError("メール / 名前を入力してください");
      return;
    }
    if (mode === "by_company" && selectedCompanies.size === 0) {
      setError("企業を1社以上選択してください");
      return;
    }
    if (mode === "by_program" && selectedProducts.size === 0) {
      setError("事業を1つ以上選択してください");
      return;
    }
    startTransition(async () => {
      try {
        const body =
          mode === "by_company"
            ? {
                email: email.trim(),
                name: name.trim(),
                companyIds: Array.from(selectedCompanies)
              }
            : {
                email: email.trim(),
                name: name.trim(),
                productCodes: Array.from(selectedProducts)
              };
        const res = await fetch("/api/admin/invite-external", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
          };
          throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
        }
        close();
        router.refresh();
      } catch (e) {
        setError(`招待に失敗しました: ${(e as Error).message}`);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-full bg-amber-600 text-white text-xs hover:bg-amber-700"
      >
        + 外部ユーザー招待
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <header className="px-6 py-4 border-b border-ink-100">
              <h3 className="text-lg font-semibold text-ink-900">外部ユーザー招待</h3>
              <p className="text-xs text-ink-500 mt-0.5">
                招待メールが送信され、本人がパスワードを設定します
              </p>
            </header>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs text-ink-500 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-ink-100 text-sm"
                />
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

              {/* モード切替タブ */}
              <div>
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ink-50 border border-ink-100">
                  <ModeTab
                    active={mode === "by_company"}
                    onClick={() => setMode("by_company")}
                    label={`企業別 (${selectedCompanies.size})`}
                  />
                  <ModeTab
                    active={mode === "by_program"}
                    onClick={() => setMode("by_program")}
                    label={`事業別 (${selectedProducts.size})`}
                  />
                </div>
                <p className="mt-2 text-[11px] text-ink-500">
                  {mode === "by_company"
                    ? "個別に企業を選択します"
                    : "選択した事業の active 契約企業を自動的に付与します"}
                </p>
              </div>

              {mode === "by_company" ? (
                <div>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="企業名で検索"
                    className="w-full px-3 py-1.5 rounded-full border border-ink-100 text-sm mb-2"
                  />
                  <ul className="max-h-[280px] overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-100">
                    {filteredCompanies.map((c) => (
                      <li key={c.id} className="px-3 py-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCompanies.has(c.id)}
                            onChange={() => toggleCompany(c.id)}
                          />
                          <span className="text-sm text-ink-900">{c.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <ul className="rounded-lg border border-ink-100 divide-y divide-ink-100">
                    {products.map((p) => (
                      <li key={p.code} className="px-3 py-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(p.code)}
                            onChange={() => toggleProduct(p.code)}
                          />
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ background: p.accent }}
                          />
                          <span className="text-sm text-ink-900">{p.name}</span>
                          <span className="text-[11px] text-ink-500 ml-auto">
                            {p.shortName}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                className="px-4 py-1.5 rounded-full bg-amber-600 text-white text-sm disabled:bg-ink-300"
              >
                {pending ? "招待中..." : "招待を送る"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function ModeTab({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-xs transition",
        active ? "bg-white shadow-xs font-medium text-ink-900" : "text-ink-500 hover:text-ink-700"
      ].join(" ")}
    >
      {label}
    </button>
  );
}
