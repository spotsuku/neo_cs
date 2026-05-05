"use client";

// 返信入力エディタ
//   - Gmail風ツールバー（Undo/Redo, 書式, リンク, 添付）
//   - Cc 入力（カンマ区切り、候補サジェスト）
//   - 添付ファイル（mock: ローカルメモリ保持のみ）
//   - チェックパネル（cc候補 / 担当者名差込 / 簡易誤字脱字）
//
// 実装メモ:
//   - リッチテキストは contentEditable + document.execCommand を使用
//     execCommand は deprecated だが今でも動く。本実装に切り替える際は
//     Tiptap / Lexical 等に置換する。
//   - Gmail 下書き連携は将来 users.drafts.create で対応（現状は mock 保存）

import { useEffect, useMemo, useRef, useState } from "react";

export type ReplyAttachment = {
  name: string;
  size: number;
};

export type ReplySubmit = {
  to: string[];
  cc: string[];
  bodyHtml: string;
  attachments: ReplyAttachment[];
};

export function ReplyEditor({
  initialBody,
  to,
  initialCc,
  ccSuggestions,
  recipientDisplayName,
  authorName,
  onSubmit,
  onCancel
}: {
  initialBody: string;
  to: string[];
  initialCc?: string[];
  ccSuggestions: { email: string; label?: string }[];
  recipientDisplayName?: string;
  authorName: string;
  onSubmit: (draft: ReplySubmit) => void;
  onCancel: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ccList, setCcList] = useState<string[]>(initialCc ?? []);
  const [ccInput, setCcInput] = useState<string>("");
  const [ccFocused, setCcFocused] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<ReplyAttachment[]>([]);
  const [bodyText, setBodyText] = useState<string>(initialBody);

  const addCc = (email: string) => {
    const v = email.trim().replace(/[,、]+$/, "");
    if (!v) return;
    setCcList((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCcInput("");
  };
  const removeCc = (email: string) => {
    setCcList((prev) => prev.filter((e) => e !== email));
  };
  const filteredSuggestions = useMemo(() => {
    const q = ccInput.trim().toLowerCase();
    return ccSuggestions.filter((s) => {
      if (ccList.includes(s.email)) return false;
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        (s.label ?? "").toLowerCase().includes(q)
      );
    });
  }, [ccSuggestions, ccList, ccInput]);

  // 初期 HTML をエディタにセット（plain text なら改行を <br> に）
  useEffect(() => {
    if (!editorRef.current) return;
    const html = initialBody.includes("<")
      ? initialBody
      : escapeHtml(initialBody).replace(/\n/g, "<br>");
    editorRef.current.innerHTML = html;
    setBodyText(editorRef.current.innerText);
  }, [initialBody]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    if (editorRef.current) setBodyText(editorRef.current.innerText);
  };

  const onInput = () => {
    if (!editorRef.current) return;
    setBodyText(editorRef.current.innerText);
  };

  const insertLink = () => {
    const url = window.prompt("URL を入力");
    if (!url) return;
    exec("createLink", url);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const checks = useMemo(
    () =>
      runChecks({
        bodyText,
        ccList,
        ccSuggestions,
        recipientDisplayName
      }),
    [bodyText, ccList, ccSuggestions, recipientDisplayName]
  );

  const submit = () => {
    const html = editorRef.current?.innerHTML ?? "";
    // 入力中で未確定の Cc も拾う
    const finalCc = ccInput.trim()
      ? Array.from(new Set([...ccList, ccInput.trim()]))
      : ccList;
    onSubmit({
      to,
      cc: finalCc,
      bodyHtml: html,
      attachments
    });
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white overflow-hidden">
      {/* ヘッダ: 宛先 / Cc */}
      <div className="px-3 pt-3 space-y-1.5 text-xs">
        <div className="flex items-start gap-2">
          <span className="text-ink-500 w-10 pt-1">To</span>
          <div className="flex-1 px-2 py-1 rounded-md bg-ink-50 text-ink-700">
            {to.join(", ")}
          </div>
        </div>
        <div className="flex items-start gap-2 relative">
          <span className="text-ink-500 w-10 pt-1">Cc</span>
          <div className="flex-1 relative">
            <div className="flex flex-wrap items-center gap-1 px-2 py-1 rounded-md border border-ink-100 focus-within:ring-2 focus-within:ring-brand-blue/30 min-h-[28px]">
              {ccList.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-800 text-[11px]"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeCc(email)}
                    className="text-sky-500 hover:text-rose-500"
                    title="削除"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onFocus={() => setCcFocused(true)}
                onBlur={() => setTimeout(() => setCcFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "、") {
                    e.preventDefault();
                    if (ccInput.trim()) addCc(ccInput);
                  } else if (
                    e.key === "Backspace" &&
                    ccInput === "" &&
                    ccList.length > 0
                  ) {
                    setCcList((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder={ccList.length === 0 ? "Cc を追加（候補から選択 / 直接入力）" : ""}
                className="flex-1 min-w-[140px] outline-none text-xs py-0.5"
              />
            </div>
            {/* 候補ドロップダウン: 入力中 or フォーカス中、かつ候補が残っている間表示 */}
            {ccFocused && filteredSuggestions.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-ink-100 bg-white shadow-lg">
                {filteredSuggestions.map((s) => (
                  <li key={s.email}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addCc(s.email);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-ink-50 flex items-center justify-between gap-2"
                    >
                      <span className="text-ink-900 truncate">{s.label}</span>
                      <span className="text-ink-400 text-[10px] truncate">
                        {s.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ツールバー */}
      <div className="mt-2 mx-3 flex items-center gap-0.5 rounded-full border border-ink-100 bg-ink-50 px-2 py-1 text-ink-700 text-sm w-fit">
        <ToolButton onClick={() => exec("undo")} title="元に戻す">↶</ToolButton>
        <ToolButton onClick={() => exec("redo")} title="やり直し">↷</ToolButton>
        <Sep />
        <ToolButton onClick={() => exec("bold")} title="太字"><b>B</b></ToolButton>
        <ToolButton onClick={() => exec("italic")} title="斜体"><i>I</i></ToolButton>
        <ToolButton onClick={() => exec("underline")} title="下線"><u>U</u></ToolButton>
        <Sep />
        <ToolButton onClick={() => exec("insertUnorderedList")} title="箇条書き">•≡</ToolButton>
        <ToolButton onClick={() => exec("insertOrderedList")} title="番号付き">1.</ToolButton>
        <Sep />
        <ToolButton onClick={insertLink} title="リンク挿入">🔗</ToolButton>
        <ToolButton
          onClick={() => fileInputRef.current?.click()}
          title="ファイル添付"
        >
          📎
        </ToolButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Sep />
        <ToolButton
          onClick={() => exec("removeFormat")}
          title="書式をクリア"
        >
          ✕
        </ToolButton>
      </div>

      {/* 本文エディタ */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        className="min-h-[180px] mx-3 mt-2 p-2 rounded-md border border-ink-100 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
      />

      {/* 添付ファイル一覧 */}
      {attachments.length > 0 && (
        <div className="mx-3 mt-2 flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-ink-50 border border-ink-100 text-[11px] text-ink-700"
            >
              📎 {a.name}
              <span className="text-ink-400">{formatSize(a.size)}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-ink-400 hover:text-rose-500"
                title="削除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* チェックパネル */}
      <CheckPanel checks={checks} />

      {/* 送信フッタ */}
      <div className="mx-3 my-3 flex items-center gap-2">
        <button
          onClick={submit}
          className="px-4 py-1.5 rounded-full bg-ink-900 text-white text-xs hover:opacity-90"
        >
          Gmail 下書きに保存
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-full bg-white border border-ink-100 text-xs text-ink-700 hover:bg-ink-50"
        >
          破棄
        </button>
        <span className="ml-auto text-[10px] text-ink-400">
          作成者: {authorName}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ツールボタン
// ─────────────────────────────────────────────
function ToolButton({
  children,
  onClick,
  title
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseDown={(e) => e.preventDefault()} // 選択範囲を維持
      className="px-2 py-1 rounded-full hover:bg-white text-ink-700 transition"
    >
      {children}
    </button>
  );
}
function Sep() {
  return <span className="w-px h-4 bg-ink-200 mx-1" />;
}

// ─────────────────────────────────────────────
// 簡易チェック（mock）
//   - 本実装時は Claude API で誤字脱字・敬語チェックに差し替え
// ─────────────────────────────────────────────
type CheckLevel = "ok" | "warn" | "info";
type CheckItem = {
  level: CheckLevel;
  label: string;
  detail: string;
};

function runChecks(input: {
  bodyText: string;
  ccList: string[];
  ccSuggestions: { email: string; label?: string }[];
  recipientDisplayName?: string;
}): CheckItem[] {
  const items: CheckItem[] = [];
  const body = input.bodyText;

  // 1) 担当者名差込チェック
  if (input.recipientDisplayName) {
    if (body.includes(input.recipientDisplayName)) {
      items.push({
        level: "ok",
        label: "宛先名",
        detail: `「${input.recipientDisplayName}」が本文に含まれています`
      });
    } else {
      items.push({
        level: "warn",
        label: "宛先名",
        detail: `本文に受信相手の氏名「${input.recipientDisplayName}」が見当たりません`
      });
    }
  }
  // テンプレ未差込トークン検出
  const tokenMatch = body.match(/\{[A-Za-z0-9_]+\}|\[\[[^\]]+\]\]/);
  if (tokenMatch) {
    items.push({
      level: "warn",
      label: "テンプレ変数",
      detail: `差込み未置換のトークン「${tokenMatch[0]}」があります`
    });
  }

  // 2) Cc 候補サジェスト
  const ccLower = new Set(input.ccList.map((e) => e.toLowerCase()));
  const missing = input.ccSuggestions.filter(
    (s) => !ccLower.has(s.email.toLowerCase())
  );
  if (missing.length > 0) {
    items.push({
      level: "info",
      label: "Cc 候補",
      detail: `本件で Cc 推奨: ${missing
        .slice(0, 3)
        .map((m) => m.label || m.email)
        .join(" / ")}`
    });
  }

  // 3) 簡易誤字脱字（記号の重複・全角半角混在の英字など）
  if (/。。|、、|！！|\?\?/.test(body)) {
    items.push({
      level: "warn",
      label: "句読点",
      detail: "句読点や記号の重複があります"
    });
  }
  if (/[Ａ-Ｚａ-ｚ０-９]/.test(body) && /[A-Za-z0-9]/.test(body)) {
    items.push({
      level: "info",
      label: "全角/半角",
      detail: "英数字の全角/半角が混在しています"
    });
  }
  // 締めの欠落
  if (body.length > 30 && !/(よろしく|お願い|ありがとう)/.test(body)) {
    items.push({
      level: "info",
      label: "結び",
      detail: "結びの定型句（よろしくお願いいたします 等）が見当たりません"
    });
  }

  if (items.length === 0) {
    items.push({
      level: "ok",
      label: "チェック",
      detail: "問題は検出されませんでした"
    });
  }
  return items;
}

function CheckPanel({ checks }: { checks: CheckItem[] }) {
  const TONE: Record<CheckLevel, string> = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warn: "bg-amber-50 text-amber-800 border-amber-100",
    info: "bg-sky-50 text-sky-700 border-sky-100"
  };
  const ICON: Record<CheckLevel, string> = {
    ok: "✓",
    warn: "⚠️",
    info: "ℹ️"
  };
  return (
    <div className="mx-3 mt-3 rounded-lg border border-ink-100 bg-white p-2.5">
      <div className="text-[11px] text-ink-500 mb-1.5 flex items-center justify-between">
        <span>送信前チェック（モック）</span>
        <span className="text-ink-400">本実装時は Claude API で精緻化</span>
      </div>
      <ul className="space-y-1">
        {checks.map((c, i) => (
          <li
            key={i}
            className={[
              "flex items-start gap-2 px-2 py-1 rounded border text-[11px] leading-relaxed",
              TONE[c.level]
            ].join(" ")}
          >
            <span>{ICON[c.level]}</span>
            <span className="font-medium w-16 shrink-0">{c.label}</span>
            <span className="flex-1">{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
