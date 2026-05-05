"use client";

import { useState, useTransition } from "react";
import type { ProgramTaskTemplate } from "@/lib/repository/types";
import {
  updateProgramTemplateMeta,
  addProgramTemplate,
  deleteProgramTemplate
} from "../cellActions";

export function TemplateEditor({
  termId,
  initialTemplates
}: {
  termId: string;
  initialTemplates: ProgramTaskTemplate[];
}) {
  const [templates, setTemplates] = useState<ProgramTaskTemplate[]>(initialTemplates);
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  function update(id: string, patch: Partial<ProgramTaskTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function save(t: ProgramTaskTemplate) {
    setSavingId(t.id);
    startTransition(async () => {
      try {
        await updateProgramTemplateMeta(t.id, termId, {
          label: t.label,
          description: t.description,
          orderNo: t.orderNo
        });
      } catch (e) {
        console.error(e);
      } finally {
        setSavingId(null);
      }
    });
  }

  function addTemplate() {
    if (!newLabel.trim()) return;
    const nextOrder =
      templates.length === 0
        ? 1
        : Math.max(...templates.map((t) => t.orderNo)) + 1;
    startTransition(async () => {
      try {
        await addProgramTemplate(termId, {
          label: newLabel.trim(),
          orderNo: nextOrder
        });
        // 楽観的反映 (実 ID は revalidate 後に正しく差し替わる)
        setTemplates((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            programTermId: termId,
            orderNo: nextOrder,
            label: newLabel.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]);
        setNewLabel("");
        setAdding(false);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function remove(t: ProgramTaskTemplate) {
    if (!confirm(`「${t.label}」を削除しますか? 関連セルも全て消えます`)) return;
    startTransition(async () => {
      try {
        await deleteProgramTemplate(t.id, termId);
        setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      } catch (e) {
        console.error(e);
      }
    });
  }

  return (
    <div className="space-y-2">
      {templates.length === 0 ? (
        <div className="liquid-surface p-8 text-center text-sm text-ink-500">
          タスク列がまだ登録されていません。下のボタンから追加できます
        </div>
      ) : (
        <ul className="space-y-2">
          {templates
            .slice()
            .sort((a, b) => a.orderNo - b.orderNo)
            .map((t) => (
              <li key={t.id} className="liquid-surface p-4">
                <div className="grid grid-cols-12 gap-3 items-start">
                  <label className="col-span-2 flex flex-col">
                    <span className="text-[11px] text-ink-500 font-medium">並び順</span>
                    <input
                      type="number"
                      min={1}
                      value={t.orderNo}
                      onChange={(e) =>
                        update(t.id, { orderNo: Number(e.target.value) || 1 })
                      }
                      className="mt-1 px-2 py-1.5 text-sm rounded-lg border border-ink-200"
                    />
                  </label>
                  <label className="col-span-5 flex flex-col">
                    <span className="text-[11px] text-ink-500 font-medium">ラベル</span>
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) => update(t.id, { label: e.target.value })}
                      className="mt-1 px-2 py-1.5 text-sm rounded-lg border border-ink-200"
                    />
                  </label>
                  <label className="col-span-5 flex flex-col">
                    <span className="text-[11px] text-ink-500 font-medium">説明</span>
                    <input
                      type="text"
                      value={t.description ?? ""}
                      onChange={(e) => update(t.id, { description: e.target.value })}
                      placeholder="任意"
                      className="mt-1 px-2 py-1.5 text-sm rounded-lg border border-ink-200"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    disabled={pending}
                    className="text-xs px-3 py-1.5 rounded-full text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    削除
                  </button>
                  <button
                    type="button"
                    onClick={() => save(t)}
                    disabled={pending && savingId === t.id}
                    className="text-xs px-3 py-1.5 rounded-full bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
                  >
                    {pending && savingId === t.id ? "保存中…" : "保存"}
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}

      {/* 新規追加 */}
      <div className="liquid-surface p-4">
        {adding ? (
          <div className="flex items-end gap-2">
            <label className="flex-1 flex flex-col">
              <span className="text-[11px] text-ink-500 font-medium">新しいタスク列名</span>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="例: 面談日程調整"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTemplate();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewLabel("");
                  }
                }}
                className="mt-1 px-2 py-1.5 text-sm rounded-lg border border-ink-200"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewLabel("");
              }}
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-full text-ink-700 border border-ink-200 hover:bg-ink-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={addTemplate}
              disabled={pending || !newLabel.trim()}
              className="text-xs px-3 py-1.5 rounded-full bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50"
            >
              {pending ? "追加中…" : "追加"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full text-sm py-2 rounded-lg border border-dashed border-ink-300 text-ink-600 hover:bg-ink-50 hover:border-ink-400"
          >
            + 新しいタスク列を追加
          </button>
        )}
      </div>
    </div>
  );
}
