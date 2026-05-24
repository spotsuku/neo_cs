"use client";

// Supabase Realtime Presence
//
// 同じ channelName を開いているユーザーを track する。
// 「誰が今このページを見ているか」を表示するため。
//
// 設計:
//   - presence key = userId (1 ユーザーが複数 tab を開いても 1 つにまとめる)
//   - 自分も含めて全員返す。UI 側で自分を除外する判断をする
//   - me が null の間は購読しない (auth ロード待ち)

import { useEffect, useState } from "react";
import { getBrowserSupabase, isRealtimeAvailable } from "@/lib/supabase/client";

export type PresenceUser = {
  userId: string;
  name: string;
  avatarUrl?: string;
  joinedAt: string;
};

export function usePresence(opts: {
  channelName: string;
  me: { userId: string; name: string; avatarUrl?: string } | null;
  enabled?: boolean;
}): PresenceUser[] {
  const { channelName, me, enabled = true } = opts;
  const [members, setMembers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!enabled || !me) return;
    if (typeof window === "undefined") return;
    if (!isRealtimeAvailable()) return;

    const sb = getBrowserSupabase();
    const channel = sb.channel(channelName, {
      config: { presence: { key: me.userId } }
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const flat: PresenceUser[] = [];
        for (const list of Object.values(state)) {
          for (const item of list) {
            flat.push(item as PresenceUser);
          }
        }
        // 同一ユーザーの複数 tab を 1 つにまとめる
        const seen = new Set<string>();
        const dedup = flat.filter((m) => {
          if (seen.has(m.userId)) return false;
          seen.add(m.userId);
          return true;
        });
        setMembers(dedup);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: me.userId,
            name: me.name,
            avatarUrl: me.avatarUrl,
            joinedAt: new Date().toISOString()
          });
        }
      });

    return () => {
      void channel.untrack();
      void sb.removeChannel(channel);
    };
  }, [channelName, me?.userId, me?.name, me?.avatarUrl, enabled]);

  return members;
}
