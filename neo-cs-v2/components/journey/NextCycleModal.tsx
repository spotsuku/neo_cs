"use client";

// 次期サイクル作成モーダル
//
// 事業ジャーニーが「8.内諾 (consent)」に遷移するタイミングで表示。
// 次期契約の主要属性（開始/終了/MRR/担当/参加人数/コース）を確認・編集してから
// 確定すると以下が一括実行される:
//   - 次期 ActiveContract 起票 (previousContractId 紐付き)
//   - 現契約のジャーニー stage を 'consent' に遷移
//   - 次期のオンボードチェックリスト自動生成
//   - 次期の BusinessJourney 'kickoff' 初期化

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNextCycleAction } from "@/app/(relationship)/companies/[id]/cycle-actions";
import { productCourses, type ProductCode } from "@/lib/mock/data";

export type NextCycleDefaults = {
  currentContractId: string;
  companyId: string;
  productCode: ProductCode;
  productLabel: string;
  /** 次期 デフォルト開始日 (現契約 endDate + 1日 想定) */
  defaultStartDate: string;
  /** 次期 デフォルト終了日 (現契約期間と同じ長さ) */
  defaultEndDate: string;
  defaultMrr: number;
  defaultOwnerName: string;
  defaultParticipants: number;
  defaultCourseKey: string;
  /** 表示用: 次期番号 */
  nextCycleNumber: number;
  cycleUnit: string;
};

export function NextCycleModal({
  open,
  defaults,
  onClose
}: {
  open: boolean;
  defaults: NextCycleDefaults | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mrr, setMrr] = useState<string>("");
  const [ownerName, setOwnerName] = useState("");
  const [participants, setParticipants] = useState<string>("");
  const [courseKey, setCourseKey] = useState("");
  const [consentNote, setConsentNote] = useState("");

  // モーダルが開いたタイミングでデフォルト値を反映
  if (open && defaults && startDate === "") {
    setStartDate(defaults.defaultStartDate);
    setEndDate(defaults.defaultEndDate);
    setMrr(String(defaults.defaultMrr));
    setOwnerName(defaults.defaultOwnerName);
    setParticipants(String(defaults.defaultParticipants));
    setCourseKey(defaults.defaultCourseKey);
  }

  if (!open || !defaults) return null;

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setMrr("");
    setOwnerName("");
    setParticipants("");
    setCourseKey("");
    setConsentNote("");
    setError(null);
  };

  const cancel = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setError(null);
    if (!startDate || !endDate) {
      setError("開始日と終了日は必須です");
      return;
    }
    const mrrNum = Number(mrr);
    if (!Number.isFinite(mrrNum) || mrrNum < 0) {
      setError("MRR は 0 以上の数値を入力してください");
      return;
    }
    const partNum = Number(participants);
    if (!Number.isFinite(partNum) || partNum < 0) {
      setError("参加人数は 0 以上の数値を入力してください");
      return;
    }
    startTransition(async () => {
      const r = await createNextCycleAction({
        currentContractId: defaults.currentContractId,
        companyId: defaults.companyId,
        startDate,
        endDate,
        mrr: mrrNum,
        ownerName: ownerName.trim() || undefined,
        participants: partNum,
        courseKey: courseKey || undefined,
        consentNote: consentNote.trim() || undefined
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      reset();
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={cancel}
        className="absolute inset-0 bg-ink-900/40 cursor-default"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-ink-100 w-[min(640px,95vw)] max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-ink-100">
          <div className="text-[11px] text-ink-500">8.内諾 → 次期作成</div>
          <h2 className="text-lg font-bold text-ink-900 mt-0.5">
            次期 ({defaults.productLabel} 第{defaults.nextCycleNumber}{defaults.cycleUnit}) を起票
          </h2>
          <p className="text-[11px] text-ink-500 mt-1">
            内諾を確定すると、次期契約・オンボードチェックリスト・事業ジャーニー (立ち上げ) が同時に作成されます。
          </p>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始日 *">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
            <Field label="終了日 *">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="MRR (¥)">
              <input
                type="number"
                value={mrr}
                onChange={(e) => setMrr(e.target.value)}
                min={0}
                step={10000}
                className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
            <Field label="参加人数">
              <input
                type="number"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                min={0}
                className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </Field>
          </div>

          <Field label="次期担当者">
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="現担当を引き継ぐ場合は空でOK"
              className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </Field>

          <Field label="コース">
            <select
              value={courseKey}
              onChange={(e) => setCourseKey(e.target.value)}
              className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
            >
              {(productCourses[defaults.productCode] ?? []).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="内諾メモ（任意）">
            <textarea
              value={consentNote}
              onChange={(e) => setConsentNote(e.target.value)}
              rows={2}
              placeholder="決裁の経緯・補足情報"
              className="w-full text-sm rounded border border-ink-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </Field>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}

          <div className="rounded-md bg-blue-50/60 border border-blue-100 px-3 py-2 text-[11px] text-blue-900">
            <div className="font-semibold mb-0.5">確定で実行される内容</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>第{defaults.nextCycleNumber}{defaults.cycleUnit}の契約を起票</li>
              <li>現契約のジャーニーを「8.内諾」に進める</li>
              <li>次期オンボードのチェックリストを自動生成</li>
              <li>次期事業ジャーニー (立ち上げ) を初期化</li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="text-sm px-3 py-1.5 rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="text-sm px-4 py-1.5 rounded-md bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-40"
          >
            {pending ? "作成中..." : "内諾を確定して次期を作成"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-ink-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
