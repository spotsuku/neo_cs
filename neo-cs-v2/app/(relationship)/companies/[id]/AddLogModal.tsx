"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { products, type ProductCode } from "@/lib/master";
import type { Contact } from "@/lib/mock/entities";
import {
  addMeetingLogAction,
  type LogTaskSuggestion,
  type LogVocSuggestion
} from "./log-actions";

// メールは Gmail タブで自動収集されるため、ログ作成は 面談 / 電話 のみ
const TYPE_OPTIONS: { value: "mtg" | "call"; label: string; hint: string }[] = [
  { value: "mtg", label: "面談 / 商談", hint: "対面・オンラインでの打合せ" },
  { value: "call", label: "電話", hint: "電話・通話での会話" }
];

// ── デモ: Notion 議事録 URL を「読み込んだ」体で AI 提案を返す ──
type AISuggestion = {
  taskSuggestions: LogTaskSuggestion[];
  vocSuggestions: LogVocSuggestion[];
  summary: string;
};
function mockNotionSuggestions(_url: string): AISuggestion {
  return {
    summary:
      "四半期レビューの議事録から AI が抽出。次回までに対応が必要なアクションと、要望として記録すべき声があります。",
    taskSuggestions: [
      { title: "次回研修テーマの提案資料を作成", priority: "med" },
      { title: "出席者の出張日程を再調整", priority: "high" }
    ],
    vocSuggestions: [
      {
        excerpt: "アンケートをもう少し簡潔にしてほしい",
        tags: ["UI改善", "アンケート"],
        priority: "med"
      },
      {
        excerpt: "他社事例をもっと共有してほしい",
        tags: ["コンテンツ要望"],
        priority: "low"
      }
    ]
  };
}

export function AddLogModal({
  open,
  onClose,
  companyId,
  defaultAuthor,
  defaultAuthorId,
  contacts,
  members
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  defaultAuthor: string;
  defaultAuthorId?: string;
  contacts: Contact[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<"mtg" | "call">("mtg");
  const [product, setProduct] = useState<ProductCode | "cross">("cross");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [good, setGood] = useState("");
  const [more, setMore] = useState("");
  const [next, setNext] = useState("");

  // 担当者 (NEO 側)
  const [authorId, setAuthorId] = useState<string>(defaultAuthorId ?? "");
  const authorName =
    members.find((m) => m.id === authorId)?.name ?? defaultAuthor;

  // 面談/商談: Notion議事録 URL + AI 提案
  const [notionUrl, setNotionUrl] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [pickedTasks, setPickedTasks] = useState<Set<number>>(new Set());
  const [pickedVocs, setPickedVocs] = useState<Set<number>>(new Set());

  // 電話: 発信元コンタクト
  const [callerContactId, setCallerContactId] = useState<string>("");

  if (!open) return null;

  function loadNotion() {
    if (!notionUrl.trim()) {
      setError("Notion URL を入力してください");
      return;
    }
    setError(null);
    const s = mockNotionSuggestions(notionUrl);
    setAiSuggestion(s);
    if (!summary && s.summary) setSummary(s.summary);
    setPickedTasks(new Set(s.taskSuggestions.map((_, i) => i)));
    setPickedVocs(new Set(s.vocSuggestions.map((_, i) => i)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const taskSuggestions =
      type === "mtg" && aiSuggestion
        ? aiSuggestion.taskSuggestions.filter((_, i) => pickedTasks.has(i))
        : [];
    const vocSuggestions =
      type === "mtg" && aiSuggestion
        ? aiSuggestion.vocSuggestions.filter((_, i) => pickedVocs.has(i))
        : [];

    startTransition(async () => {
      const r = await addMeetingLogAction({
        companyId,
        date,
        type,
        product,
        title,
        summary,
        good,
        more,
        next,
        authorName,
        notionUrl: type === "mtg" ? notionUrl : undefined,
        callerContactId: type === "call" ? callerContactId || undefined : undefined,
        taskSuggestions,
        vocSuggestions
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // フォームを初期化して閉じる
      setTitle("");
      setSummary("");
      setGood("");
      setMore("");
      setNext("");
      setNotionUrl("");
      setAiSuggestion(null);
      setPickedTasks(new Set());
      setPickedVocs(new Set());
      setCallerContactId("");
      onClose();
      router.refresh();
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
        className="bg-white rounded-2xl shadow-liquid-lg w-full max-w-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
      >
        <div>
          <h2 className="text-lg font-bold text-ink-900">ログを追加</h2>
          <p className="text-xs text-ink-500 mt-1">
            電話 / 面談（商談）の記録を残します（メールは Gmail タブで自動収集されます）
          </p>
        </div>

        <div>
          <span className="text-[11px] text-ink-500 font-medium">種別</span>
          <div className="mt-1 flex gap-2">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setType(o.value)}
                className={[
                  "flex-1 text-left px-3 py-2 rounded-lg border transition",
                  type === o.value
                    ? "border-ink-900 bg-ink-50/60 ring-1 ring-ink-900"
                    : "border-ink-200 hover:bg-ink-50/40"
                ].join(" ")}
              >
                <div className="text-sm font-medium text-ink-900">{o.label}</div>
                <div className="text-[10px] text-ink-500 mt-0.5">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 種別ごとの専用ブロック ── */}
        {type === "mtg" && (
          <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3 space-y-3">
            <div>
              <span className="text-[11px] text-ink-500 font-medium">
                Notion 議事録 URL
              </span>
              <p className="text-[10px] text-ink-400 mt-0.5">
                Notion AI で作成した議事録を貼り付けると、ToDo / VOC 候補を自動抽出します
              </p>
              <div className="mt-1 flex gap-2">
                <input
                  type="url"
                  value={notionUrl}
                  onChange={(e) => setNotionUrl(e.target.value)}
                  placeholder="https://www.notion.so/…"
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-ink-200"
                />
                <button
                  type="button"
                  onClick={loadNotion}
                  className="px-3 py-1.5 text-xs rounded-full bg-ink-900 text-white hover:bg-ink-800"
                >
                  読み込む
                </button>
              </div>
            </div>

            {aiSuggestion && (
              <div className="space-y-3">
                <div className="text-[11px] text-ink-700 bg-white rounded-md border border-ink-100 px-3 py-2">
                  🤖 {aiSuggestion.summary}
                </div>

                {aiSuggestion.taskSuggestions.length > 0 && (
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium mb-1">
                      個社ToDo に追加する候補
                    </div>
                    <ul className="space-y-1">
                      {aiSuggestion.taskSuggestions.map((t, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-xs bg-white rounded-md border border-ink-100 px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={pickedTasks.has(i)}
                            onChange={(e) => {
                              setPickedTasks((prev) => {
                                const s = new Set(prev);
                                if (e.target.checked) s.add(i);
                                else s.delete(i);
                                return s;
                              });
                            }}
                          />
                          <span className="flex-1 text-ink-800">{t.title}</span>
                          <span className="text-[10px] text-ink-500">
                            優先度: {t.priority}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSuggestion.vocSuggestions.length > 0 && (
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium mb-1">
                      VOC（顧客の声）に追加する候補
                    </div>
                    <ul className="space-y-1">
                      {aiSuggestion.vocSuggestions.map((v, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-xs bg-white rounded-md border border-ink-100 px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={pickedVocs.has(i)}
                            onChange={(e) => {
                              setPickedVocs((prev) => {
                                const s = new Set(prev);
                                if (e.target.checked) s.add(i);
                                else s.delete(i);
                                return s;
                              });
                            }}
                          />
                          <span className="flex-1 text-ink-800">{v.excerpt}</span>
                          {v.tags && v.tags.length > 0 && (
                            <span className="text-[10px] text-ink-500">
                              {v.tags.join(" / ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {type === "call" && (
          <div className="rounded-lg border border-ink-100 bg-ink-50/40 p-3 space-y-2">
            <span className="text-[11px] text-ink-500 font-medium">誰から</span>
            <select
              value={callerContactId}
              onChange={(e) => setCallerContactId(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200 bg-white"
            >
              <option value="">選択してください</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.department || "—"}{c.title ? ` / ${c.title}` : ""}）
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-400">
              顧客側の発信元です。NEO側担当者は下の「担当者」で指定します
            </p>
          </div>
        )}

        {/* ── 共通フィールド ── */}
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-[11px] text-ink-500 font-medium">日付</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500 font-medium">事業</span>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductCode | "cross")}
              className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            >
              <option value="cross">横断 (複数事業)</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.shortName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500 font-medium">担当者 (NEO)</span>
            <select
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            >
              {!members.some((m) => m.id === authorId) && (
                <option value="">{defaultAuthor}</option>
              )}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">
            タイトル <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === "call"
                ? "例: 5月研修の参加者調整"
                : "例: 四半期レビューMTG（人事部長 + 古野）"
            }
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="text-[11px] text-ink-500 font-medium">内容・要約</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="やり取りの要約・本文を残す"
            className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200 leading-relaxed"
          />
        </label>

        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer hover:text-ink-700">
            ＋ Good / More / Next を記録する
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] text-ink-500 font-medium">Good</span>
              <textarea
                value={good}
                onChange={(e) => setGood(e.target.value)}
                rows={2}
                className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-500 font-medium">More</span>
              <textarea
                value={more}
                onChange={(e) => setMore(e.target.value)}
                rows={2}
                className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-500 font-medium">Next</span>
              <textarea
                value={next}
                onChange={(e) => setNext(e.target.value)}
                rows={2}
                className="mt-1 w-full px-2 py-1.5 text-sm rounded-lg border border-ink-200"
              />
            </label>
          </div>
        </details>

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
            {pending ? "追加中…" : "追加"}
          </button>
        </div>
      </form>
    </div>
  );
}
