"use client";

// 1on1 ログ新規記録フォーム
// - mock リポジトリの create を直接呼ぶ (Server Action 化は Supabase 移行時に)
// - 入力途中は localStorage に下書き保存 + 離脱警告

import { useState } from "react";
import { useRouter } from "next/navigation";
import { oneOnOneLogRepo, DEFAULT_ORG_ID } from "@/lib/repository";
import type { AppUser } from "@/lib/repository";
import { useDraftPersistence } from "@/lib/hooks/useDraftPersistence";

type Form = {
  occurredAt: string;
  durationMin: string;
  topic: string;
  summary: string;
  good: string;
  more: string;
  nextAction: string;
  isPrivate: boolean;
  managerUserId: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function OneOnOneForm({
  memberUserId,
  memberName,
  managerUserId,
  managerName,
  managers
}: {
  memberUserId: string;
  memberName: string;
  managerUserId: string | null;
  managerName: string | null;
  managers: AppUser[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Form>({
    occurredAt: today,
    durationMin: "30",
    topic: "",
    summary: "",
    good: "",
    more: "",
    nextAction: "",
    isPrivate: false,
    managerUserId: managerUserId ?? managers[0]?.id ?? ""
  });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const draftKey = `one_on_one:${memberUserId}:new`;
  const { savedAt: localSavedAt, markClean } = useDraftPersistence(
    draftKey,
    form,
    dirty
  );

  function patch<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function submit(): Promise<void> {
    if (!form.summary.trim() && !form.topic.trim()) {
      setSaveState("error");
      setSaveError("トピックまたはサマリーは必須です");
      return;
    }
    if (!form.managerUserId) {
      setSaveState("error");
      setSaveError("実施者を選択してください");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const dur = Number(form.durationMin);
      await oneOnOneLogRepo.create({
        organizationId: DEFAULT_ORG_ID,
        managerUserId: form.managerUserId,
        memberUserId,
        occurredAt: `${form.occurredAt}T00:00:00Z`,
        durationMin: Number.isFinite(dur) && dur > 0 ? dur : undefined,
        topic: form.topic.trim() || undefined,
        summary: form.summary.trim() || undefined,
        good: form.good.trim() || undefined,
        more: form.more.trim() || undefined,
        nextAction: form.nextAction.trim() || undefined,
        isPrivate: form.isPrivate,
        authorUserId: form.managerUserId
      });
      setSaveState("saved");
      setDirty(false);
      markClean();
      router.refresh();
      setForm({
        occurredAt: today,
        durationMin: "30",
        topic: "",
        summary: "",
        good: "",
        more: "",
        nextAction: "",
        isPrivate: false,
        managerUserId: form.managerUserId
      });
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-md border border-borderc text-body bg-surface focus-ring mt-1";
  const labelTextCls = "text-caption text-neutral-500 font-medium";

  const otherManagers = managers.filter((u) => u.id !== memberUserId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className={labelTextCls}>実施日</span>
          <input
            type="date"
            className={inputCls}
            value={form.occurredAt}
            onChange={(e) => patch("occurredAt", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelTextCls}>所要時間(分)</span>
          <input
            type="number"
            className={inputCls}
            value={form.durationMin}
            onChange={(e) => patch("durationMin", e.target.value)}
            min={0}
          />
        </label>
        <label className="block">
          <span className={labelTextCls}>実施者</span>
          <select
            className={inputCls}
            value={form.managerUserId}
            onChange={(e) => patch("managerUserId", e.target.value)}
          >
            {otherManagers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelTextCls}>トピック</span>
        <input
          type="text"
          className={inputCls}
          value={form.topic}
          onChange={(e) => patch("topic", e.target.value)}
          placeholder={`${memberName}さんとの今回のテーマ`}
        />
      </label>

      <label className="block">
        <span className={labelTextCls}>サマリー</span>
        <textarea
          className={`${inputCls} min-h-[100px]`}
          value={form.summary}
          onChange={(e) => patch("summary", e.target.value)}
          placeholder="話した内容の要点"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelTextCls}>Good (うまくいっていること)</span>
          <textarea
            className={`${inputCls} min-h-[80px] bg-success-50 border-success-100`}
            value={form.good}
            onChange={(e) => patch("good", e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelTextCls}>More (改善・支援が必要な点)</span>
          <textarea
            className={`${inputCls} min-h-[80px] bg-warning-50 border-warning-100`}
            value={form.more}
            onChange={(e) => patch("more", e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelTextCls}>Next Action (次回までに)</span>
        <textarea
          className={`${inputCls} min-h-[60px]`}
          value={form.nextAction}
          onChange={(e) => patch("nextAction", e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <label className="inline-flex items-center gap-2 text-body text-neutral-700">
          <input
            type="checkbox"
            checked={form.isPrivate}
            onChange={(e) => patch("isPrivate", e.target.checked)}
            className="w-4 h-4 rounded accent-neutral-900 focus-ring"
          />
          マネージャー間のみ閲覧可 (本人非公開)
        </label>
        <div className="flex items-center gap-3">
          <SaveStatus state={saveState} error={saveError} localSavedAt={localSavedAt} />
          <button
            type="button"
            onClick={submit}
            disabled={saveState === "saving"}
            className="px-4 py-2 rounded-pill bg-neutral-900 text-surface text-body hover:bg-neutral-700 disabled:opacity-50 focus-ring"
          >
            {saveState === "saving" ? "記録中..." : "1on1を記録"}
          </button>
        </div>
      </div>

      {managerName && form.managerUserId === managerUserId && (
        <p className="text-caption text-neutral-500">
          実施者: {managerName} (現在ログイン中)
        </p>
      )}
    </div>
  );
}

function SaveStatus({
  state,
  error,
  localSavedAt
}: {
  state: SaveState;
  error: string | null;
  localSavedAt: string | null;
}) {
  if (state === "saving") {
    return <span className="text-caption text-neutral-500">記録中...</span>;
  }
  if (state === "saved") {
    return <span className="text-caption text-success-600">✓ 記録しました</span>;
  }
  if (state === "error") {
    return (
      <span className="text-caption text-danger-600">
        失敗: {error ?? "不明なエラー"}
      </span>
    );
  }
  if (localSavedAt) {
    return (
      <span className="text-caption text-neutral-500">
        下書き保存 {localSavedAt.slice(11, 16)}
      </span>
    );
  }
  return null;
}
