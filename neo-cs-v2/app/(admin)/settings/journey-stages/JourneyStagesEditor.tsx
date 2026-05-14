"use client";

// ジャーニーステージ定義の編集UI (Client Component)
// - 既存ステージの inline 編集 (name / description / keyActions / displayOrder / color)
// - 新規追加・削除
// - 既定値リセット

import { useState, useTransition } from "react";
import type {
  JourneyStageDefinition,
  JourneyType
} from "@/lib/repository/types";
import {
  deleteJourneyStageAction,
  resetJourneyStagesAction,
  upsertJourneyStageAction
} from "./actions";

type Draft = {
  /** 既存編集時の元 stageKey (rename 検出用)。新規時は undefined */
  previousStageKey?: string;
  stageKey: string;
  displayOrder: number;
  name: string;
  description: string;
  keyActions: string;
  color: string;
};

const EMPTY: Draft = {
  stageKey: "",
  displayOrder: 0,
  name: "",
  description: "",
  keyActions: "",
  color: "#3D9EFF"
};

function toDraft(s: JourneyStageDefinition): Draft {
  return {
    previousStageKey: s.stageKey,
    stageKey: s.stageKey,
    displayOrder: s.displayOrder,
    name: s.name,
    description: s.description,
    keyActions: s.keyActions ?? "",
    color: s.color ?? "#3D9EFF"
  };
}

export function JourneyStagesEditor({
  journeyType,
  initialStages
}: {
  journeyType: JourneyType;
  initialStages: JourneyStageDefinition[];
}) {
  const [stages, setStages] = useState<JourneyStageDefinition[]>(initialStages);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startEdit = (s: JourneyStageDefinition) => {
    setAdding(false);
    setEditingKey(s.stageKey);
    setDraft(toDraft(s));
    setError(null);
  };

  const startAdd = () => {
    setEditingKey(null);
    setAdding(true);
    setDraft({
      ...EMPTY,
      displayOrder:
        stages.length > 0
          ? Math.max(...stages.map((s) => s.displayOrder)) + 1
          : 1
    });
    setError(null);
  };

  const cancel = () => {
    setEditingKey(null);
    setAdding(false);
    setDraft(EMPTY);
    setError(null);
  };

  const save = () => {
    setError(null);
    if (!draft.stageKey.trim() || !draft.name.trim()) {
      setError("ステージキーとステージ名は必須です");
      return;
    }
    startTransition(async () => {
      const r = await upsertJourneyStageAction({
        journeyType,
        previousStageKey: draft.previousStageKey,
        stageKey: draft.stageKey.trim(),
        displayOrder: draft.displayOrder,
        name: draft.name.trim(),
        description: draft.description.trim(),
        color: draft.color || undefined,
        keyActions: draft.keyActions.trim() || undefined
      });
      if (!r.ok) {
        setError("保存に失敗しました");
        return;
      }
      // 楽観的更新: 既存編集 → 置換 / 新規 → 追加
      setStages((prev) => {
        const next: JourneyStageDefinition = {
          id: draft.previousStageKey ?? `local-${draft.stageKey}`,
          organizationId: "local",
          journeyType,
          stageKey: draft.stageKey,
          displayOrder: draft.displayOrder,
          name: draft.name,
          description: draft.description,
          color: draft.color,
          keyActions: draft.keyActions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        if (draft.previousStageKey) {
          return prev
            .map((s) => (s.stageKey === draft.previousStageKey ? next : s))
            .sort((a, b) => a.displayOrder - b.displayOrder);
        }
        return [...prev, next].sort((a, b) => a.displayOrder - b.displayOrder);
      });
      cancel();
    });
  };

  const remove = (s: JourneyStageDefinition) => {
    if (
      !confirm(
        `「${s.name}」を削除しますか?\n既にこのステージにいる企業/事業は表示が崩れる可能性があります。`
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteJourneyStageAction({
        journeyType,
        stageKey: s.stageKey
      });
      if (!r.ok) {
        setError("削除に失敗しました");
        return;
      }
      setStages((prev) => prev.filter((x) => x.stageKey !== s.stageKey));
    });
  };

  const reset = () => {
    if (!confirm("既定のステージ定義に戻します。カスタマイズは失われます。")) return;
    startTransition(async () => {
      const r = await resetJourneyStagesAction({ journeyType });
      if (!r.ok) {
        setError("リセットに失敗しました");
        return;
      }
      // ページをハードリロードで最新を取得
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-[11px] text-ink-500">
          {journeyType === "company"
            ? "会社単位・永続。企業のNEOへの関わり方を表現"
            : "商材×期 単位。契約更新+アップセルへの進捗を表現"}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="px-3 py-1.5 text-[12px] rounded-md border border-ink-200 hover:bg-ink-50 disabled:opacity-50"
          >
            既定値に戻す
          </button>
          <button
            type="button"
            onClick={startAdd}
            disabled={pending || adding}
            className="px-3 py-1.5 text-[12px] rounded-md bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
          >
            + ステージを追加
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 text-[12px] p-2">
          {error}
        </div>
      )}

      <ol className="space-y-2">
        {stages.map((s) => {
          const isEditing = editingKey === s.stageKey;
          if (isEditing) {
            return (
              <li
                key={s.stageKey}
                className="rounded-xl border border-blue-300 bg-blue-50/40 p-4"
              >
                <DraftEditor
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={cancel}
                  pending={pending}
                />
              </li>
            );
          }
          return (
            <li
              key={s.stageKey}
              className="rounded-xl border border-ink-100 bg-white p-3 flex items-start gap-3"
            >
              <div
                className="w-1 self-stretch rounded-full"
                style={{ background: s.color ?? "#3D9EFF" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-500 px-1.5 py-0.5 rounded bg-ink-50">
                    #{s.displayOrder}
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-ink-400 font-mono">
                    {s.stageKey}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-ink-700">
                  {s.description}
                </div>
                {s.keyActions && (
                  <div className="mt-1 text-[11px] text-ink-500">
                    支援: {s.keyActions}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(s)}
                  className="px-2 py-1 text-[11px] rounded border border-ink-200 hover:bg-ink-50"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  className="px-2 py-1 text-[11px] rounded border border-red-200 text-red-700 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </li>
          );
        })}

        {adding && (
          <li className="rounded-xl border border-blue-300 bg-blue-50/40 p-4">
            <DraftEditor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
              pending={pending}
            />
          </li>
        )}
      </ol>
    </div>
  );
}

function DraftEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  pending
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="表示順">
          <input
            type="number"
            value={draft.displayOrder}
            onChange={(e) =>
              setDraft({ ...draft, displayOrder: Number(e.target.value) })
            }
            className="w-full rounded border border-ink-200 px-2 py-1.5 text-[13px]"
          />
        </Field>
        <Field label="ステージキー (英数)">
          <input
            type="text"
            value={draft.stageKey}
            onChange={(e) =>
              setDraft({ ...draft, stageKey: e.target.value })
            }
            placeholder="例: small_win"
            className="w-full rounded border border-ink-200 px-2 py-1.5 text-[13px] font-mono"
          />
        </Field>
        <Field label="アクセントカラー">
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="w-16 h-9 rounded border border-ink-200"
          />
        </Field>
      </div>
      <Field label="ステージ名">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded border border-ink-200 px-2 py-1.5 text-[13px]"
        />
      </Field>
      <Field label="説明 (この状態は何か)">
        <textarea
          value={draft.description}
          onChange={(e) =>
            setDraft({ ...draft, description: e.target.value })
          }
          rows={2}
          className="w-full rounded border border-ink-200 px-2 py-1.5 text-[13px]"
        />
      </Field>
      <Field label="キーアクション・必要な支援">
        <textarea
          value={draft.keyActions}
          onChange={(e) => setDraft({ ...draft, keyActions: e.target.value })}
          rows={2}
          className="w-full rounded border border-ink-200 px-2 py-1.5 text-[13px]"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-[12px] rounded-md border border-ink-200"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-3 py-1.5 text-[12px] rounded-md bg-ink-900 text-white disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-ink-500 mb-1">{label}</div>
      {children}
    </label>
  );
}
