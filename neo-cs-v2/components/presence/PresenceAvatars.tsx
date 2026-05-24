"use client";

// Presence 表示 (この画面を今見ているユーザー一覧)
//
// 自分自身は除外。アバター画像があれば表示、なければ名前のイニシャル + 色。

import type { PresenceUser } from "@/lib/realtime/usePresence";

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

const PALETTE = [
  "#7C9CFF",
  "#FF8C8C",
  "#7CDB9A",
  "#FFB766",
  "#B89BFF",
  "#5BC8DA",
  "#E97AB2",
  "#A8C84F"
];

function colorForName(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function PresenceAvatars({
  members,
  myUserId,
  max = 5,
  label = "同時編集中"
}: {
  members: PresenceUser[];
  myUserId?: string | null;
  max?: number;
  label?: string;
}) {
  const others = myUserId
    ? members.filter((m) => m.userId !== myUserId)
    : members;
  if (others.length === 0) return null;

  const visible = others.slice(0, max);
  const rest = others.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {visible.map((m) => (
          <div
            key={m.userId}
            title={`${m.name} さんが閲覧中`}
            className="w-7 h-7 rounded-full ring-2 ring-white shadow-sm flex items-center justify-center text-[11px] font-medium text-white overflow-hidden"
            style={{ background: colorForName(m.name) }}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatarUrl}
                alt={m.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initials(m.name)
            )}
          </div>
        ))}
      </div>
      {rest > 0 && (
        <span className="text-[11px] text-ink-500 font-medium">+{rest}</span>
      )}
      <span className="text-[11px] text-ink-500">{label}</span>
    </div>
  );
}
