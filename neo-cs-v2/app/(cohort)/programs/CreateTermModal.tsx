"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  products,
  productCourses,
  hasMultipleCourses,
  type ProductCode
} from "@/lib/mock/data";
import type { ProgramTerm } from "@/lib/repository/types";
import { createProgramTerm } from "./termActions";

export function CreateTermModal({
  open,
  onClose,
  existingTerms,
  defaultProductCode
}: {
  open: boolean;
  onClose: () => void;
  existingTerms: ProgramTerm[];
  defaultProductCode: ProductCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [productCode, setProductCode] = useState<ProductCode>(defaultProductCode);
  // スコープ: "common" = 全コース共通 / "course" = コース別
  const [scope, setScope] = useState<"common" | "course">("common");
  const [courseKey, setCourseKey] = useState<string>("");
  const [cycleNo, setCycleNo] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [startedAt, setStartedAt] = useState<string>("");
  const [closedAt, setClosedAt] = useState<string>("");
  const [copyFromTermId, setCopyFromTermId] = useState<string>("");

  const courses = productCourses[productCode] ?? [];
  const showCourseSelect = hasMultipleCourses(productCode);

  // 複製元候補: 同じ事業 (productCode) の既存 term だけ
  const copyCandidates = useMemo(
    () =>
      existingTerms
        .filter((t) => t.productCode === productCode)
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
    [existingTerms, productCode]
  );

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError("ラベルを入力してください");
      return;
    }
    if (showCourseSelect && scope === "course" && !courseKey) {
      setError("コースを選択してください");
      return;
    }
    startTransition(async () => {
      try {
        const r = await createProgramTerm({
          productCode,
          courseKey: showCourseSelect
            ? scope === "course"
              ? courseKey
              : null
            : courses[0]?.key ?? null,
          cycleNo: cycleNo ? Number(cycleNo) : null,
          label: label.trim(),
          startedAt: startedAt || undefined,
          closedAt: closedAt || undefined,
          copyFromTermId: copyFromTermId || undefined
        });
        onClose();
        // ルータキャッシュを無効化してから編集画面へ遷移
        // (revalidatePath だけだとクライアントキャッシュに古いツリーが残ることがある)
        router.refresh();
        router.push(`/programs/${r.termId}/edit`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "作成に失敗しました");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-liquid-lg w-full max-w-lg p-6 space-y-4"
      >
        <div>
          <h2 className="text-lg font-bold text-ink-900">新しい期を作成</h2>
          <p className="text-xs text-ink-500 mt-1">
            事業 / コース / 期の単位で定期タスクを管理します
          </p>
        </div>

        <Field
          label="事業"
          required
          hint="どの研修ジャンルに属する期かを指定します"
        >
          <select
            value={productCode}
            onChange={(e) => {
              setProductCode(e.target.value as ProductCode);
              setCourseKey("");
              setScope("common");
              setCopyFromTermId("");
            }}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          >
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.shortName}
              </option>
            ))}
          </select>
        </Field>

        {showCourseSelect && (
          <Field
            label="ToDoの適用範囲"
            required
            hint="全コース共通のToDoか、特定コースのみのToDoかを選択します"
          >
            <div className="flex gap-2">
              <ScopeOption
                active={scope === "common"}
                onClick={() => {
                  setScope("common");
                  setCourseKey("");
                }}
                title="全コース共通"
                desc="この事業の全コースに適用"
              />
              <ScopeOption
                active={scope === "course"}
                onClick={() => setScope("course")}
                title="コース別"
                desc="特定コースだけに適用"
              />
            </div>
            {scope === "course" && (
              <select
                value={courseKey}
                onChange={(e) => setCourseKey(e.target.value)}
                className="mt-2 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
              >
                <option value="">コースを選択…</option>
                {courses.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.shortName}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <Field
          label="開催回 / 期"
          hint="その期が何回目の開催か。例: 7 → 第7期。空なら未指定"
        >
          <input
            type="number"
            min={1}
            value={cycleNo}
            onChange={(e) => setCycleNo(e.target.value)}
            placeholder="(任意)"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          />
        </Field>

        <Field
          label="ラベル"
          required
          hint="一覧やカードに表示されるこの期の名称"
        >
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例: アカデミア リーダー育成 第7期"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="開始日" hint="この期の運用開始日">
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            />
          </Field>
          <Field label="終了日" hint="この期のクローズ予定日 (任意)">
            <input
              type="date"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            />
          </Field>
        </div>

        <Field
          label="タスク列を複製する"
          hint="他の期からタスク列名・順序・カテゴリを丸ごとコピーします (期日と責任者はコピーされません)"
        >
          <select
            value={copyFromTermId}
            onChange={(e) => setCopyFromTermId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
          >
            <option value="">複製しない (空の状態で作成)</option>
            {copyCandidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-2 rounded-full text-sm text-ink-700 border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-full text-sm bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {pending ? "作成中…" : "作成して編集へ"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ScopeOption({
  active,
  onClick,
  title,
  desc
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 text-left px-3 py-2 rounded-lg border transition",
        active
          ? "border-ink-900 bg-ink-50/60 ring-1 ring-ink-900"
          : "border-ink-200 hover:bg-ink-50/40"
      ].join(" ")}
    >
      <div className="text-sm font-medium text-ink-900">{title}</div>
      <div className="text-[11px] text-ink-500 mt-0.5">{desc}</div>
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink-500 font-medium">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-ink-400 leading-snug">{hint}</p>}
    </label>
  );
}
