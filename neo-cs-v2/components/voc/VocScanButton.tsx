"use client";

// 「VOC 候補をスキャン」ボタン (SurveyDetail 用)
// - 与えられたテキスト群から extractVocCandidates でプレビュー
// - 1クリックで vocItemRepo.create にまとめて投入

import { useMemo, useState } from "react";
import { extractVocCandidates, VOC_TAG_LABEL, type VocSourceTextInput, type VocTag } from "@/lib/domain/voc/voc";
import { createVocItemAction } from "@/app/(relationship)/voc/actions";

export function VocScanButton({
  inputs,
  contractId,
  companyId,
  label = "VOC候補をスキャン"
}: {
  inputs: VocSourceTextInput[];
  contractId?: string;
  companyId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const candidates = useMemo(
    () => extractVocCandidates(inputs.map((i) => ({ ...i, contractId, companyId }))),
    [inputs, contractId, companyId]
  );

  async function saveOne(idx: number) {
    const c = candidates[idx];
    setErr(null);
    const res = await createVocItemAction({
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      contractId: c.contractId,
      companyId: c.companyId,
      excerpt: c.excerpt,
      tags: c.suggestedTags,
      status: "open",
      priority: "med"
    });
    if (res.ok) {
      setSavedIds((s) => new Set([...s, idx]));
    } else {
      setErr(res.message);
    }
  }

  async function saveAll() {
    setErr(null);
    for (let i = 0; i < candidates.length; i++) {
      if (savedIds.has(i)) continue;
      await saveOne(i);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 hover:bg-neutral-50 focus-ring"
      >
        🔎 {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-900/40 cursor-default"
          />
          <div className="relative bg-surface rounded-xl shadow-cardHover border border-neutral-100 w-[min(720px,92vw)] max-h-[85vh] overflow-auto p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-h4 font-semibold text-neutral-900">
                VOC候補スキャン結果 ({candidates.length} 件)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={candidates.length === 0 || savedIds.size === candidates.length}
                  className="px-3 py-1.5 rounded-pill bg-neutral-900 text-surface text-caption hover:bg-neutral-700 disabled:opacity-50 focus-ring"
                >
                  ✓ すべて新規VOCとして登録
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-pill bg-surface border border-neutral-300 text-caption text-neutral-700 focus-ring"
                >
                  閉じる
                </button>
              </div>
            </div>

            {err && (
              <p className="text-caption text-danger-700">エラー: {err}</p>
            )}

            {candidates.length === 0 ? (
              <p className="text-body text-neutral-500">
                要望キーワードを含む発言は見つかりませんでした
              </p>
            ) : (
              <ul className="space-y-2">
                {candidates.map((c, i) => {
                  const saved = savedIds.has(i);
                  return (
                    <li
                      key={`${c.sourceId}-${i}`}
                      className="rounded-md border border-neutral-100 bg-surface p-3 space-y-1.5"
                    >
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div className="flex flex-wrap gap-1">
                          {c.suggestedTags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex px-2 py-0.5 rounded-pill border border-neutral-300 bg-neutral-50 text-caption text-neutral-700"
                            >
                              {VOC_TAG_LABEL[t as VocTag] ?? t}
                            </span>
                          ))}
                        </div>
                        {saved ? (
                          <span className="text-caption text-success-700">✓ 登録済</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => saveOne(i)}
                            className="px-2.5 py-1 rounded-pill bg-info-500 text-surface text-caption hover:bg-info-600 focus-ring"
                          >
                            + 個別登録
                          </button>
                        )}
                      </div>
                      <p className="text-body text-neutral-900 whitespace-pre-wrap">
                        {c.excerpt}
                      </p>
                      <p className="text-caption text-neutral-500">
                        マッチ: {c.matchedKeywords.join(", ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
