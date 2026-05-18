"use client";

// メールドメイン用 chip 入力。
// - Enter / "," / 空白 / 全角カンマ "、" で chip 化
// - × で個別削除
// - Backspace で末尾を取り出して編集
// - 形式不正 / 重複は即時エラー表示 (送信側 edit-actions でも再バリデーション)

import { useState, useRef } from "react";

const DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const SEP_RE = /[,\s、]+/;

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

export function DomainChipInput({
  value,
  onChange,
  placeholder
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (rawCandidates: string[]) => {
    const next = [...value];
    let lastError: string | null = null;
    for (const raw of rawCandidates) {
      const v = normalize(raw);
      if (!v) continue;
      if (!DOMAIN_RE.test(v)) {
        lastError = `ドメイン形式が不正です: ${raw}`;
        continue;
      }
      if (next.includes(v)) {
        lastError = `既に登録済み: ${v}`;
        continue;
      }
      next.push(v);
    }
    setError(lastError);
    if (next.length !== value.length) onChange(next);
  };

  const tryCommitDraft = () => {
    if (draft.trim().length === 0) return;
    commit(draft.split(SEP_RE));
    setDraft("");
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
    setError(null);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      tryCommitDraft();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      const last = value[value.length - 1];
      remove(value.length - 1);
      setDraft(last);
    }
  };

  return (
    <div>
      <div
        role="group"
        onClick={() => inputRef.current?.focus()}
        className="mt-0.5 flex flex-wrap items-center gap-1 rounded-lg border border-ink-200 px-2 py-1.5 focus-within:border-ink-400 cursor-text"
      >
        {value.map((d, i) => (
          <span
            key={d}
            className="inline-flex items-center gap-1 rounded-full bg-ink-50 border border-ink-100 px-2 py-0.5 text-xs text-ink-700"
          >
            {d}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="text-ink-400 hover:text-rose-600 leading-none"
              aria-label={`${d} を削除`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKey}
          onBlur={() => tryCommitDraft()}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (SEP_RE.test(text)) {
              e.preventDefault();
              commit(text.split(SEP_RE));
              setDraft("");
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[8rem] text-sm bg-transparent focus:outline-hidden"
        />
      </div>
      {error && <div className="mt-1 text-[10px] text-rose-600">{error}</div>}
    </div>
  );
}
