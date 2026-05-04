"use client";

/**
 * /settings/products/[code] のコース編集タブ
 *
 * - 一覧 + 編集モーダル
 * - 追加 / 削除 / code(courseKey) / name / displayOrder 編集
 * - code 変更時は影響契約数を取得し、確認モーダルでガード
 * - service_role 経由 DB 更新は actions.ts (Server Actions) に委譲
 * - audit_logs はリポジトリ層フックで自動記録
 */

import { useEffect, useState, useTransition } from "react";
import {
  upsertCourseAction,
  deleteCourseAction,
  countAffectedContractsAction,
  listCoursesAction,
  type CourseDraft
} from "./actions";
import type { ProductCourse } from "@/lib/repository/types";

type Props = {
  productCode: string;
  initialCourses: ProductCourse[];
  accent: string;
};

const COURSE_KEY_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$|^[a-z0-9]$/i;

const inputCls =
  "w-full px-3 py-2 rounded-md bg-surface border border-ink-200 text-body text-ink-900 focus-ring";

export default function CoursesEditor({ productCode, initialCourses, accent }: Props) {
  const [courses, setCourses] = useState<ProductCourse[]>(initialCourses);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Supabase ドライバ時は DB の真値を反映
  useEffect(() => {
    let cancelled = false;
    listCoursesAction(productCode)
      .then((rows) => {
        if (!cancelled && rows.length > 0) setCourses(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [productCode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openNew = () => {
    setEditing({
      mode: "create",
      draft: {
        productCode,
        courseKey: "",
        name: "",
        shortName: "",
        description: "",
        displayOrder: courses.length + 1
      }
    });
  };

  const openEdit = (c: ProductCourse) => {
    setEditing({
      mode: "edit",
      original: c,
      draft: {
        productCode,
        previousCourseKey: c.courseKey,
        courseKey: c.courseKey,
        name: c.name,
        shortName: c.shortName ?? "",
        description: c.description ?? "",
        displayOrder: c.displayOrder
      }
    });
  };

  const handleDelete = (c: ProductCourse) => {
    if (!confirm(`コース「${c.name}」(${c.courseKey}) を削除します。よろしいですか？`)) return;
    startTransition(async () => {
      const res = await deleteCourseAction(productCode, c.courseKey);
      if (res.ok) {
        setCourses((cs) => cs.filter((x) => x.courseKey !== c.courseKey));
        setToast(res.message);
      } else {
        setToast(res.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="surface-muted rounded-surface p-5">
        <div className="text-body text-ink-700 leading-relaxed">
          研修内のコース区分（コードID / 名称 / 表示順）を編集します。コードIDの変更は既存契約に影響するため、変更前に影響件数を確認してください。
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="surface rounded-md p-3 text-body text-ink-900 border border-ink-200"
        >
          {toast}
        </div>
      )}

      <div className="surface rounded-surface overflow-hidden">
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-caption text-ink-500 bg-surface-muted border-b border-ink-100">
              <th className="px-4 py-2.5 font-medium w-14">順</th>
              <th className="px-3 py-2.5 font-medium w-48">コードID (course_key)</th>
              <th className="px-3 py-2.5 font-medium">コース名</th>
              <th className="px-3 py-2.5 font-medium w-40">短縮名</th>
              <th className="px-3 py-2.5 font-medium w-32 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-body text-ink-500">
                  コースが登録されていません
                </td>
              </tr>
            )}
            {courses.map((c) => (
              <tr key={c.courseKey} className="border-b border-ink-50 last:border-0">
                <td className="px-4 py-2.5 text-ink-700">{c.displayOrder}</td>
                <td className="px-3 py-2.5 font-mono text-body text-ink-900">{c.courseKey}</td>
                <td className="px-3 py-2.5 text-ink-900">{c.name}</td>
                <td className="px-3 py-2.5 text-ink-700">{c.shortName ?? "—"}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => openEdit(c)}
                    className="focus-ring rounded-md text-body text-ink-700 px-3 py-1 hover:bg-ink-50"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    disabled={isPending}
                    className="focus-ring rounded-md text-body text-danger-600 px-3 py-1 hover:bg-danger-50 disabled:opacity-50"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={openNew}
        className="focus-ring w-full rounded-md text-body text-ink-700 px-4 py-3 border border-dashed border-ink-200 bg-surface hover:bg-ink-50"
      >
        + コースを追加
      </button>

      {editing && (
        <CourseEditModal
          state={editing}
          accent={accent}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setCourses((cs) => {
              const prev = editing.mode === "edit" ? editing.original.courseKey : null;
              const filtered = prev ? cs.filter((x) => x.courseKey !== prev) : cs;
              const merged = [...filtered.filter((x) => x.courseKey !== saved.courseKey), saved];
              return merged.sort((a, b) => a.displayOrder - b.displayOrder);
            });
            setEditing(null);
            setToast("コースを保存しました");
          }}
        />
      )}
    </div>
  );
}

type EditingState =
  | { mode: "create"; draft: CourseDraft }
  | { mode: "edit"; original: ProductCourse; draft: CourseDraft };

function CourseEditModal({
  state,
  accent,
  onClose,
  onSaved
}: {
  state: EditingState;
  accent: string;
  onClose: () => void;
  onSaved: (c: ProductCourse) => void;
}) {
  const [draft, setDraft] = useState<CourseDraft>(state.draft);
  const [error, setError] = useState<string | null>(null);
  const [affected, setAffected] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRename =
    state.mode === "edit" && state.original.courseKey !== draft.courseKey;

  // rename 検知時は影響範囲を取得 (fetch のみ effect で行い、表示は派生値で)
  useEffect(() => {
    if (!isRename || state.mode !== "edit") {
      return;
    }
    let cancelled = false;
    countAffectedContractsAction(state.original.productCode, state.original.courseKey)
      .then((n) => {
        if (!cancelled) setAffected(n);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isRename, state]);

  const renameAffected = isRename ? affected : null;
  const warning =
    isRename && renameAffected !== null && renameAffected > 0
      ? `このコードIDには ${renameAffected} 件の既存契約が紐付いています。変更すると全契約の course_key を一括更新します`
      : null;
  const needsConfirm = !!warning;

  const validate = (): string | null => {
    if (!draft.courseKey.trim()) return "コードIDは必須です";
    if (!COURSE_KEY_RE.test(draft.courseKey))
      return "コードIDは半角英数とハイフンのみ使用できます (2〜40文字)";
    if (!draft.name.trim()) return "コース名は必須です";
    return null;
  };

  const submit = (confirmRename: boolean) => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertCourseAction(draft, { confirmRename });
      if (res.ok) {
        onSaved({
          productCode: draft.productCode,
          courseKey: draft.courseKey,
          name: draft.name,
          shortName: draft.shortName || undefined,
          description: draft.description || undefined,
          displayOrder: draft.displayOrder ?? 1
        });
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="surface rounded-surface w-full max-w-xl max-h-[90vh] overflow-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="text-h4 font-semibold text-ink-900">
            {state.mode === "create" ? "コースを追加" : "コースを編集"}
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-md text-body text-ink-500 hover:text-ink-700 px-2 py-1"
          >
            ✕
          </button>
        </div>

        <Field
          label="コードID (course_key)"
          hint="半角英数とハイフン。契約・セッション等で参照される識別子"
        >
          <input
            className={inputCls}
            value={draft.courseKey}
            onChange={(e) => setDraft({ ...draft, courseKey: e.target.value })}
            placeholder="例: pjt / leader / basic"
          />
        </Field>

        {warning && (
          <div className="rounded-md border border-warning-500 bg-warning-50 px-3 py-2 text-body text-warning-700">
            {warning}
          </div>
        )}
        {affected !== null && !warning && isRename && (
          <div className="text-body text-ink-500">影響する既存契約: {affected} 件</div>
        )}

        <Field label="コース名（正式）">
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>

        <Field label="短縮名">
          <input
            className={inputCls}
            value={draft.shortName ?? ""}
            onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
          />
        </Field>

        <Field label="表示順 (display_order)">
          <input
            type="number"
            className={inputCls}
            value={draft.displayOrder ?? 1}
            onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) })}
          />
        </Field>

        <Field label="説明">
          <textarea
            className={`${inputCls} h-24 resize-none`}
            value={draft.description ?? ""}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>

        {error && (
          <div className="rounded-md border border-danger-500 bg-danger-50 px-3 py-2 text-body text-danger-700">
            {error}
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="focus-ring rounded-md bg-surface border border-ink-300 text-ink-900 text-body px-4 py-2 hover:bg-ink-50"
          >
            キャンセル
          </button>
          <button
            onClick={() => submit(needsConfirm)}
            disabled={isPending}
            className="focus-ring rounded-md text-white text-body px-4 py-2 disabled:opacity-50"
            style={{ background: accent }}
          >
            {isPending ? "保存中…" : needsConfirm ? "影響を許容して保存" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-caption font-medium text-ink-500 mb-1.5">{label}</label>
      {children}
      {hint && <div className="mt-1 text-caption text-ink-500">{hint}</div>}
    </div>
  );
}
