"use client";

// 契約の追加 / 編集モーダル (兼用)
// - mode="create": 必須項目を全部入力する空フォーム
// - mode="edit"  : 既存契約の値を初期値にしたフォーム
//
// 権限チェックは Server Action 側 (createContractAction / updateContractAction) で
// requirePermission("contract_manage") されているため、未許可ユーザはここで
// 投稿しても 例外で弾かれる (UI 側でも親が canManageContracts を見て表示制御済み)。

import { useState, useTransition } from "react";
import {
  createContractAction,
  updateContractAction
} from "./contract-actions";
import { products, productCourses } from "@/lib/master";
import type { ProductCode, ContractStatus } from "@/lib/repository/types";

// 編集モードで受け取る既存契約は ActiveContract / Contract のどちらでも良いよう
// 必要最小限のフィールドだけ要求する。
type ContractFormInitial = {
  id: string;
  product: string;
  courseKey: string;
  startDate: string;
  endDate?: string;
  mrr?: number;
  revenue?: number;
  ownerName: string;
  participants: number;
  cycleNumber: number;
  status: string;
};

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: "handoff", label: "handoff (引継ぎ未着手)" },
  { value: "onboarding", label: "onboarding (オンボ進行中)" },
  { value: "active", label: "active (通常運用)" },
  { value: "renewal_window", label: "renewal_window (期末90日以内)" },
  { value: "renewed", label: "renewed (旧サイクル)" },
  { value: "churned", label: "churned (解約)" }
];

type Props = {
  mode: "create" | "edit";
  companyId: string;
  initial?: ContractFormInitial;
  onClose: () => void;
};

export function ContractFormModal({ mode, companyId, initial, onClose }: Props) {
  const [product, setProduct] = useState<ProductCode>(
    (initial?.product as ProductCode) ?? (products[0]?.code as ProductCode)
  );
  const courseList = productCourses[product] ?? [];
  const [courseKey, setCourseKey] = useState<string>(
    initial?.courseKey ?? courseList[0]?.key ?? "default"
  );
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [mrr, setMrr] = useState<string>(
    initial?.mrr !== undefined ? String(initial.mrr) : ""
  );
  const [revenue, setRevenue] = useState<string>(
    initial?.revenue !== undefined ? String(initial.revenue) : ""
  );
  const [ownerName, setOwnerName] = useState(initial?.ownerName ?? "");
  const [participants, setParticipants] = useState<string>(
    String(initial?.participants ?? 0)
  );
  const [cycleNumber, setCycleNumber] = useState<string>(
    String(initial?.cycleNumber ?? 1)
  );
  const [status, setStatus] = useState<ContractStatus>(
    (initial?.status as ContractStatus) ?? "active"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = () => {
    setError(null);
    const mrrNum = mrr.trim() === "" ? undefined : Number(mrr);
    const revenueNum = revenue.trim() === "" ? undefined : Number(revenue);
    const participantsNum = Number(participants);
    const cycleNum = Number(cycleNumber);
    if (!ownerName.trim()) {
      setError("担当者名は必須です");
      return;
    }
    if (Number.isNaN(participantsNum) || participantsNum < 0) {
      setError("参加人数は 0 以上の整数で入力してください");
      return;
    }
    if (Number.isNaN(cycleNum) || cycleNum < 1) {
      setError("第◯期 / 第◯回 は 1 以上の整数で入力してください");
      return;
    }
    start(async () => {
      if (mode === "create") {
        const r = await createContractAction({
          companyId,
          product,
          courseKey,
          startDate,
          endDate: endDate.trim() || undefined,
          mrr: mrrNum,
          revenue: revenueNum,
          ownerName: ownerName.trim(),
          participants: participantsNum,
          cycleNumber: cycleNum,
          status
        });
        if (!r.ok) {
          setError(r.message);
          return;
        }
      } else if (initial) {
        const r = await updateContractAction({
          contractId: initial.id,
          companyId,
          patch: {
            courseKey,
            startDate,
            endDate: endDate.trim() === "" ? null : endDate,
            mrr: mrr.trim() === "" ? null : mrrNum,
            revenue: revenue.trim() === "" ? null : revenueNum,
            ownerName: ownerName.trim(),
            participants: participantsNum,
            cycleNumber: cycleNum,
            status
          }
        });
        if (!r.ok) {
          setError(r.message);
          return;
        }
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">
            {mode === "create" ? "新しい契約を追加" : "契約を編集"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-700 text-sm"
          >
            閉じる
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-ink-700">
              研修
              <select
                disabled={mode === "edit"}
                value={product}
                onChange={(e) => {
                  const p = e.target.value as ProductCode;
                  setProduct(p);
                  const next = (productCourses[p] ?? [])[0]?.key ?? "default";
                  setCourseKey(next);
                }}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm disabled:bg-ink-50"
              >
                {products.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-700">
              コース
              <select
                value={courseKey}
                onChange={(e) => setCourseKey(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              >
                {(productCourses[product] ?? [{ key: "default", shortName: "-" }]).map(
                  (c) => (
                    <option key={c.key} value={c.key}>
                      {c.shortName}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="text-xs text-ink-700">
              開始日
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              終了日 (任意)
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              MRR (円・任意)
              <input
                type="number"
                value={mrr}
                onChange={(e) => setMrr(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              売上 (円・任意 / 単発型)
              <input
                type="number"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              担当者名
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
                placeholder="例: 古野"
              />
            </label>
            <label className="text-xs text-ink-700">
              参加人数
              <input
                type="number"
                min={0}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              第◯期 / 第◯回 (cycleNumber)
              <input
                type="number"
                min={1}
                value={cycleNumber}
                onChange={(e) => setCycleNumber(e.target.value)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink-700">
              ステータス
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className="mt-1 w-full border border-ink-200 rounded-md px-2 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
        </div>
        <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-xs text-ink-700 px-3 py-1.5 rounded-md border border-ink-200 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="text-xs text-white px-3 py-1.5 rounded-md bg-ink-900 hover:bg-ink-800 disabled:opacity-60"
          >
            {pending ? "保存中…" : mode === "create" ? "追加する" : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
