"use client";

// 企業ビジョン編集セクション
//   NEO参画動機 / 中長期目標 / 今年度目標 / 活用方針 を 4 フィールドで管理。
//   表示モード: テキスト + 編集ボタン
//   編集モード: textarea で 4 フィールド一括編集 → 保存

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CompanyVision, CompanyVisionLog } from "@/lib/repository/types";
import { setCompanyVisionAction } from "@/app/(relationship)/companies/[id]/vision-actions";

const FIELDS: Array<{
  key: keyof Pick<
    CompanyVision,
    "joinMotivation" | "longTermGoal" | "thisYearGoal" | "usagePolicy"
  >;
  label: string;
  placeholder: string;
}> = [
  {
    key: "joinMotivation",
    label: "NEO参画動機",
    placeholder: "なぜ NEO の導入を決めたか（背景・課題感・期待）"
  },
  {
    key: "longTermGoal",
    label: "中長期で NEO と実現したいこと",
    placeholder: "3〜5年スパンで NEO と一緒に達成したい姿"
  },
  {
    key: "thisYearGoal",
    label: "今年度達成したいこと",
    placeholder: "今期中に出したい具体的な成果・指標"
  },
  {
    key: "usagePolicy",
    label: "NEO活用方針",
    placeholder: "社内での位置付け、運用ルール、決裁者・リソース配分など"
  }
];

const FIELD_LABEL: Record<
  "joinMotivation" | "longTermGoal" | "thisYearGoal" | "usagePolicy",
  string
> = {
  joinMotivation: "NEO参画動機",
  longTermGoal: "中長期ゴール",
  thisYearGoal: "今年度ゴール",
  usagePolicy: "NEO活用方針"
};

export function CompanyVisionSection({
  companyId,
  vision,
  logs = []
}: {
  companyId: string;
  vision: CompanyVision | null;
  logs?: CompanyVisionLog[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState({
    joinMotivation: vision?.joinMotivation ?? "",
    longTermGoal: vision?.longTermGoal ?? "",
    thisYearGoal: vision?.thisYearGoal ?? "",
    usagePolicy: vision?.usagePolicy ?? ""
  });

  const startEdit = () => {
    setValues({
      joinMotivation: vision?.joinMotivation ?? "",
      longTermGoal: vision?.longTermGoal ?? "",
      thisYearGoal: vision?.thisYearGoal ?? "",
      usagePolicy: vision?.usagePolicy ?? ""
    });
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await setCompanyVisionAction({
        companyId,
        ...values
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const isEmpty =
    !vision?.joinMotivation &&
    !vision?.longTermGoal &&
    !vision?.thisYearGoal &&
    !vision?.usagePolicy;

  return (
    <section className="liquid-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-700">企業ビジョン</div>
          <div className="mt-0.5 text-[11px] text-ink-500">
            NEO参画の動機・目標・活用方針 — CS 戦略整理 / 引継ぎ用
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs px-3 py-1.5 rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50"
          >
            ✎ 編集
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-[11px] font-medium text-ink-700 mb-1">
                {f.label}
              </span>
              <textarea
                value={values[f.key]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
                placeholder={f.placeholder}
                rows={3}
                className="w-full text-sm rounded border border-ink-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-300"
              />
            </label>
          ))}
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
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
              onClick={save}
              disabled={pending}
              className="text-sm px-4 py-1.5 rounded-md bg-ink-900 text-white font-semibold hover:bg-ink-800 disabled:opacity-40"
            >
              {pending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="text-[12px] text-ink-500 py-4 text-center bg-ink-50/40 rounded-md border border-dashed border-ink-200">
          まだ未記入です。「✎ 編集」から各項目を入力してください。
        </div>
      ) : (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map((f) => {
            const v = vision?.[f.key];
            return (
              <div
                key={f.key}
                className="rounded-md border border-ink-100 bg-ink-50/30 p-3"
              >
                <dt className="text-[11px] font-semibold text-ink-700 mb-1">
                  {f.label}
                </dt>
                <dd
                  className={[
                    "text-[12px] whitespace-pre-wrap leading-relaxed",
                    v ? "text-ink-800" : "text-ink-400"
                  ].join(" ")}
                >
                  {v || "（未記入）"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {!editing && (
        <div className="flex items-center justify-between pt-2 border-t border-ink-100">
          {vision?.updatedAt ? (
            <span className="text-[10px] text-ink-400">
              最終更新: {vision.updatedAt.slice(0, 10)}
            </span>
          ) : (
            <span />
          )}
          {logs.length > 0 && (
            <span className="text-[10px] text-ink-500">
              改訂履歴 {logs.length} 件
            </span>
          )}
        </div>
      )}

      {!editing && logs.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-ink-600 hover:text-ink-900 select-none">
            ▸ 改訂履歴を表示
          </summary>
          <ul className="mt-2 space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-md border border-ink-100 bg-ink-50/30 p-2.5 space-y-1.5"
              >
                <div className="flex items-center gap-2 flex-wrap text-[10px] text-ink-500">
                  <span className="font-mono">
                    {log.recordedAt.slice(0, 10)} {log.recordedAt.slice(11, 16)}
                  </span>
                  <span className="text-ink-400">変更前のスナップショット</span>
                  <span className="ml-auto flex flex-wrap gap-1">
                    {log.changedFields.map((f) => (
                      <span
                        key={f}
                        className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-medium"
                      >
                        {FIELD_LABEL[f]}を改訂
                      </span>
                    ))}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(["joinMotivation", "longTermGoal", "thisYearGoal", "usagePolicy"] as const).map((f) => {
                    const v = log[f];
                    if (!v) return null;
                    return (
                      <div
                        key={f}
                        className="rounded border border-ink-100 bg-white p-2"
                      >
                        <div className="text-[10px] text-ink-500 font-semibold mb-0.5">
                          {FIELD_LABEL[f]}
                        </div>
                        <div className="text-[11px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                          {v}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
