"use client";

// Supabase Realtime postgres_changes 購読用の汎用 hook
//
// 想定: 1 画面で 1〜複数テーブルを購読し、外部 (別ユーザー / cron / Admin Studio)
// からの DB 変更を即時にローカル state へ反映する。
//
// 注意:
//   - REPO_DRIVER=mock 環境 (NEXT_PUBLIC_SUPABASE_URL なし) では noop
//   - 同じ channelName を使うと 1 つの WebSocket チャネルに統合される
//     ので、関連テーブルは同じ channelName でまとめると効率的

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserSupabase, isRealtimeAvailable } from "@/lib/supabase/client";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export type RealtimeChange<T> = {
  eventType: RealtimeEventType;
  new: T | null;
  old: T | null;
  table: string;
};

export type RealtimeSubscription<T> = {
  table: string;
  filter?: string;
  onChange: (e: RealtimeChange<T>) => void;
};

/**
 * 1 つのテーブル変更を購読する。
 * 同じ channelName を共有する別の hook と組み合わせる場合は useRealtimeChannel を使う。
 */
export function useRealtimeTable<T extends Record<string, unknown>>(opts: {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  onChange: (e: RealtimeChange<T>) => void;
  enabled?: boolean;
}): void {
  useRealtimeChannel({
    channelName: opts.channelName,
    enabled: opts.enabled,
    subscriptions: [
      {
        table: opts.table,
        filter: opts.filter,
        onChange: opts.onChange as (e: RealtimeChange<Record<string, unknown>>) => void
      }
    ],
    schema: opts.schema
  });
}

/**
 * 複数テーブルを 1 つの channel にまとめて購読する。
 * テーブル間で関連が強い (例: weekly_reviews + weekly_actions + weekly_next_actions)
 * 場合はこちらが効率的。
 */
export function useRealtimeChannel(opts: {
  channelName: string;
  subscriptions: RealtimeSubscription<Record<string, unknown>>[];
  schema?: string;
  enabled?: boolean;
}): void {
  const { channelName, subscriptions, schema = "public", enabled = true } = opts;

  // 最新の callback を ref で保持して、callback の変化で resubscribe しないようにする
  const callbacksRef = useRef(subscriptions);
  callbacksRef.current = subscriptions;

  // 購読の identity は table+filter のリストで決まる
  const subscriptionKey = subscriptions
    .map((s) => `${s.table}:${s.filter ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!isRealtimeAvailable()) return;

    const sb = getBrowserSupabase();
    const channel = sb.channel(channelName);

    callbacksRef.current.forEach((sub, idx) => {
      channel.on(
        // 型は any にせざるをえない (Supabase の型定義が string literal を要求)
        "postgres_changes" as never,
        {
          event: "*",
          schema,
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {})
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // ref から最新 callback を読む (resubscribe を避けるため)
          const current = callbacksRef.current[idx];
          if (!current) return;
          current.onChange({
            eventType: payload.eventType as RealtimeEventType,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
            table: sub.table
          });
        }
      );
    });

    channel.subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
    // subscriptionKey が変わったときだけ resubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, schema, subscriptionKey, enabled]);
}
