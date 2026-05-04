"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEMO_WIPE_CONFIRM_TOKEN,
  filterDemoByRange,
  type DemoRange
} from "@/lib/domain/demo-data";
import { deleteOneDemoCompany, wipeDemoData, promoteToProd } from "./actions";

type Row = {
  id: string;
  name: string;
  industry: string;
  createdAt: string | null;
};

export function DemoDataPanel({
  companies,
  counts
}: {
  companies: Row[];
  counts: { all: number; last7d: number; last24h: number };
}) {
  const router = useRouter();
  const [range, setRange] = useState<DemoRange>("all");
  const [confirmInput, setConfirmInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // 期間フィルタ後の対象 (純関数)
  const filtered = useMemo(() => {
    const ids = new Set(
      filterDemoByRange(
        companies.map((c) => ({ id: c.id, createdAt: c.createdAt })),
        range
      ).map((c) => c.id)
    );
    return companies.filter((c) => ids.has(c.id));
  }, [companies, range]);

  const canWipe = confirmInput.trim() === DEMO_WIPE_CONFIRM_TOKEN && filtered.length > 0;

  function handleDeleteOne(id: string) {
    if (!confirm(`企業ID=${id} を削除します。CASCADE で関連も道連れ削除されます。よろしいですか?`))
      return;
    startTransition(async () => {
      const r = await deleteOneDemoCompany(id);
      if (r.ok) {
        setMessage(`削除しました: ${id}`);
        router.refresh();
      } else {
        setMessage(`失敗: ${r.error}`);
      }
    });
  }

  function handleWipe() {
    if (!canWipe) return;
    if (
      !confirm(
        `本当に ${filtered.length} 社のデモ企業 (とCASCADE関連) を削除しますか? この操作は取り消せません。`
      )
    )
      return;
    startTransition(async () => {
      const r = await wipeDemoData({
        range,
        confirmInput,
        selectedCount: filtered.length
      });
      if (r.ok) {
        setMessage(`一括削除完了: ${r.deletedCount} 件`);
        setConfirmInput("");
        router.refresh();
      } else {
        setMessage(`失敗: ${r.error}`);
      }
    });
  }

  function handlePromote(id: string) {
    if (!confirm(`企業ID=${id} を「本番データ」(is_demo=false) に変更します。`))
      return;
    startTransition(async () => {
      const r = await promoteToProd(id);
      if (r.ok) {
        setMessage(`本番データへ昇格: ${id}`);
        router.refresh();
      } else {
        setMessage(`失敗: ${r.error}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 件数サマリー */}
      <section className="grid grid-cols-3 gap-4">
        <Stat label="全期間 (is_demo=true)" value={counts.all} />
        <Stat label="過去7日" value={counts.last7d} />
        <Stat label="過去24時間" value={counts.last24h} />
      </section>

      {/* フィルタ + 一括削除 */}
      <section className="liquid-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-ink-500">対象期間:</span>
          {(["24h", "7d", "all"] as DemoRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                "px-3 py-1 rounded-full text-xs border transition",
                range === r
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-100 hover:bg-ink-50"
              ].join(" ")}
            >
              {r === "24h" ? "24時間以内" : r === "7d" ? "7日以内" : "全期間"}
            </button>
          ))}
          <span className="ml-auto text-xs text-ink-500">
            対象: <span className="font-semibold text-ink-900">{filtered.length}</span> 社
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-ink-100">
          <label className="text-xs text-ink-700">
            一括削除を実行するには{" "}
            <code className="px-1 py-0.5 rounded bg-ink-50 text-rose-600">
              {DEMO_WIPE_CONFIRM_TOKEN}
            </code>{" "}
            と入力:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={DEMO_WIPE_CONFIRM_TOKEN}
            className="px-3 py-1.5 rounded-full border border-ink-100 text-xs bg-white"
          />
          <button
            type="button"
            disabled={!canWipe || pending}
            onClick={handleWipe}
            className="px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs hover:bg-rose-700 disabled:opacity-40"
          >
            {pending ? "削除中..." : `🗑 一括削除 (${filtered.length}社)`}
          </button>
        </div>

        {message && (
          <div className="text-xs text-ink-700 bg-ink-50 rounded-lg px-3 py-2">{message}</div>
        )}
      </section>

      {/* 一覧 */}
      <section className="liquid-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-ink-500 border-b border-ink-100">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">企業名</th>
              <th className="px-4 py-3 font-medium">業種</th>
              <th className="px-4 py-3 font-medium">作成日時</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-ink-50 last:border-0 hover:bg-ink-50/40"
              >
                <td className="px-4 py-2 font-mono text-[11px] text-ink-500">{c.id}</td>
                <td className="px-4 py-2 text-ink-900">{c.name}</td>
                <td className="px-4 py-2 text-ink-700">{c.industry}</td>
                <td className="px-4 py-2 text-ink-500 text-xs">
                  {c.createdAt ? c.createdAt.slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handlePromote(c.id)}
                    className="text-xs text-emerald-600 hover:underline disabled:opacity-40"
                  >
                    本番に昇格
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDeleteOne(c.id)}
                    className="text-xs text-rose-600 hover:underline disabled:opacity-40"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-ink-500">
                  該当するデモ企業はありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="liquid-surface p-4">
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink-900">{value}</div>
    </div>
  );
}
