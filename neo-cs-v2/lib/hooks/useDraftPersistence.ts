"use client";

// 編集中ドラフトの localStorage 永続化 + 離脱警告 (beforeunload)
//
// 役割:
//   - フォーム編集中の値を localStorage に書き込む(debounce)
//   - dirty=true の間 beforeunload を仕掛けてタブ閉じ・遷移時に警告
//   - savedAt を返してUIに「最後の自動保存」表示できるようにする
//
// 設計方針:
//   - サーバー永続化 (DraftRepo) はSupabase切替時に Server Action から呼ぶ。
//     クライアントの localStorage は補助 (オフライン保護・即時復元) と割り切る。
//   - ドラフトは entityType + entityId + ownerName で名前空間化
//
// 使い方:
//   const { savedAt, restore, clear, markClean } = useDraftPersistence(
//     "weekly_review:c-aeon:academia:2026-04-20",
//     draft,
//     dirty
//   );

import { useEffect, useRef, useState } from "react";

const KEY_PREFIX = "neo-cs:draft:";
const DEBOUNCE_MS = 600;

export type DraftEnvelope<T> = {
  payload: T;
  savedAt: string; // ISO
};

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export function useDraftPersistence<T>(
  key: string,
  value: T,
  dirty: boolean
): {
  savedAt: string | null;
  /** localStorage から payload を読み出す。SSR時はnull */
  restore: () => T | null;
  /** ドラフトを削除する (保存完了時に呼ぶ) */
  clear: () => void;
  /** 「ダーティではない」状態に戻す。clear + 警告解除 */
  markClean: () => void;
} {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isDirtyRef = useRef(dirty);
  useEffect(() => {
    isDirtyRef.current = dirty;
  }, [dirty]);

  // debounced save
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dirty) return;
    const t = window.setTimeout(() => {
      try {
        const env: DraftEnvelope<T> = {
          payload: value,
          savedAt: new Date().toISOString()
        };
        window.localStorage.setItem(storageKey(key), JSON.stringify(env));
        setSavedAt(env.savedAt);
      } catch {
        // QuotaExceeded等は無視 (UI上は保存中マークが消えるだけ)
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [key, value, dirty]);

  // beforeunload: dirty なら離脱警告
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        // Chrome/Safari: returnValue が必要。文字列内容はブラウザに無視される
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const restore = (): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(storageKey(key));
      if (!raw) return null;
      const env = JSON.parse(raw) as DraftEnvelope<T>;
      setSavedAt(env.savedAt);
      return env.payload;
    } catch {
      return null;
    }
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey(key));
    } catch {
      /* noop */
    }
    setSavedAt(null);
  };

  const markClean = () => {
    isDirtyRef.current = false;
    clear();
  };

  return { savedAt, restore, clear, markClean };
}
