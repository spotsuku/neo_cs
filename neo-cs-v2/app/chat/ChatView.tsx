"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ChatChannel, ChatMessage } from "@/lib/repository/types";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import {
  postMessageAction,
  ensureDmAction,
  listMessagesAction,
  listChannelsAction
} from "./actions";

const KIND_LABEL: Record<ChatChannel["kind"], string> = {
  dm: "DM",
  program: "事業部",
  email_thread: "メール"
};

const KIND_COLOR: Record<ChatChannel["kind"], string> = {
  dm: "bg-sky-50 text-sky-700 border-sky-200",
  program: "bg-emerald-50 text-emerald-700 border-emerald-200",
  email_thread: "bg-violet-50 text-violet-700 border-violet-200"
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const today = new Date("2026-04-24");
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export function ChatView({
  initialChannels,
  initialChannelId,
  initialMessages,
  memberNames,
  currentUserName
}: {
  initialChannels: ChatChannel[];
  initialChannelId: string;
  initialMessages: ChatMessage[];
  memberNames: string[];
  currentUserName: string;
}) {
  const { names: assigneeOptions } = useActiveMembers();
  const [, startTransition] = useTransition();

  const [channels, setChannels] = useState<ChatChannel[]>(initialChannels);
  const [selectedId, setSelectedId] = useState<string>(initialChannelId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState<string>("");
  const [showNewDm, setShowNewDm] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const refreshChannels = () => {
    startTransition(async () => {
      const next = await listChannelsAction();
      setChannels(next);
    });
  };

  const selectChannel = (id: string) => {
    setSelectedId(id);
    startTransition(async () => {
      const next = await listMessagesAction(id);
      setMessages(next);
    });
  };

  const parseMentions = (body: string): string[] => {
    const found = new Set<string>();
    for (const name of assigneeOptions.length ? assigneeOptions : memberNames) {
      const re = new RegExp(`[@＠]${name}`, "g");
      if (re.test(body)) found.add(name);
    }
    return Array.from(found);
  };

  const send = async () => {
    const body = input.trim();
    if (!body || !selectedId || busy) return;
    setBusy(true);
    try {
      const msg = await postMessageAction({
        channelId: selectedId,
        body,
        mentions: parseMentions(body)
      });
      setMessages((prev) => [...prev, msg]);
      setInput("");
      refreshChannels();
    } finally {
      setBusy(false);
    }
  };

  const startDmWith = async (otherName: string) => {
    if (otherName === currentUserName) return;
    const ch = await ensureDmAction(otherName);
    setShowNewDm(false);
    refreshChannels();
    selectChannel(ch.id);
  };

  const grouped = useMemo(() => {
    return {
      dm: channels.filter((c) => c.kind === "dm"),
      program: channels.filter((c) => c.kind === "program"),
      email_thread: channels.filter((c) => c.kind === "email_thread")
    };
  }, [channels]);

  const selected = channels.find((c) => c.id === selectedId);
  const dmCandidates = (assigneeOptions.length ? assigneeOptions : memberNames).filter(
    (n) => n !== currentUserName
  );

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">チャット</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            DM・事業部・メール社内チャットの統合ビュー
          </p>
        </div>
      </header>

      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-3 h-[calc(100vh-180px)] min-h-[560px]">
        {/* 左サイドバー: チャンネル一覧 */}
        <aside className="rounded-xl border border-ink-100 bg-white overflow-y-auto">
          <Section title="DM" actionLabel="＋ 新規" onAction={() => setShowNewDm((s) => !s)}>
            {showNewDm && (
              <div className="px-2 py-2 border-b border-ink-100 bg-ink-50/50">
                <p className="text-[11px] text-ink-500 mb-1">送信先を選択</p>
                <div className="flex flex-wrap gap-1">
                  {dmCandidates.map((n) => (
                    <button
                      key={n}
                      onClick={() => startDmWith(n)}
                      className="px-2 py-0.5 text-xs rounded-full border border-ink-200 hover:bg-ink-100"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {grouped.dm.map((c) => (
              <ChannelRow
                key={c.id}
                ch={c}
                active={c.id === selectedId}
                onClick={() => selectChannel(c.id)}
              />
            ))}
          </Section>
          <Section title="事業部">
            {grouped.program.map((c) => (
              <ChannelRow
                key={c.id}
                ch={c}
                active={c.id === selectedId}
                onClick={() => selectChannel(c.id)}
              />
            ))}
          </Section>
          <Section title="メールスレッド">
            {grouped.email_thread.slice(0, 20).map((c) => (
              <ChannelRow
                key={c.id}
                ch={c}
                active={c.id === selectedId}
                onClick={() => selectChannel(c.id)}
              />
            ))}
          </Section>
        </aside>

        {/* メインパネル */}
        <section className="rounded-xl border border-ink-100 bg-white flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="border-b border-ink-100 px-4 py-3 flex items-center gap-2">
                <span
                  className={[
                    "px-1.5 py-0.5 rounded border text-[10px] font-medium",
                    KIND_COLOR[selected.kind]
                  ].join(" ")}
                >
                  {KIND_LABEL[selected.kind]}
                </span>
                <h2 className="text-sm font-semibold text-ink-900">{selected.title}</h2>
                {selected.kind === "email_thread" && selected.emailThreadId && (
                  <Link
                    href={`/inbox?threadId=${selected.emailThreadId}`}
                    className="ml-auto text-xs text-brand-blue hover:underline"
                  >
                    受信箱で開く →
                  </Link>
                )}
                {selected.kind === "dm" && selected.members && (
                  <span className="ml-auto text-[11px] text-ink-500">
                    {selected.members.join(" ・ ")}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-ink-50/30">
                {messages.length === 0 ? (
                  <p className="text-xs text-ink-400 text-center py-8">
                    まだメッセージはありません
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.authorName === currentUserName;
                    return (
                      <div
                        key={m.id}
                        className={[
                          "flex gap-2",
                          mine ? "justify-end" : "justify-start"
                        ].join(" ")}
                      >
                        {!mine && (
                          <div className="w-7 h-7 rounded-full bg-ink-200 text-[11px] flex items-center justify-center text-ink-700 font-medium shrink-0">
                            {m.authorName.slice(0, 1)}
                          </div>
                        )}
                        <div className={["max-w-[72%]", mine ? "text-right" : ""].join(" ")}>
                          <div className="flex items-center gap-2 text-[11px] text-ink-500 mb-0.5">
                            {!mine && <span className="font-medium text-ink-700">{m.authorName}</span>}
                            <span>{formatTime(m.createdAt)}</span>
                          </div>
                          <div
                            className={[
                              "inline-block px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
                              mine
                                ? "bg-brand-blue text-white rounded-tr-sm"
                                : "bg-white border border-ink-100 text-ink-800 rounded-tl-sm"
                            ].join(" ")}
                          >
                            {m.body}
                          </div>
                          {m.mentions.length > 0 && (
                            <div className="mt-0.5 text-[10px] text-ink-400">
                              メンション: {m.mentions.map((n) => `@${n}`).join(" ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-ink-100 p-3">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="メッセージ（@名前 でメンション・ ⌘ + Enter で送信）"
                    className="flex-1 resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || busy}
                    className="self-end px-4 py-2 rounded-lg bg-ink-900 text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    送信
                  </button>
                </div>
                {selected.kind === "email_thread" && (
                  <p className="text-[10px] text-ink-500 mt-1.5">
                    💡 このスレッドに投稿すると、受信箱の社内チャットにも反映されます
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">
              チャンネルを選択してください
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
          {title}
        </h3>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-[11px] text-brand-blue hover:underline"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChannelRow({
  ch,
  active,
  onClick
}: {
  ch: ChatChannel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-2 hover:bg-ink-50 border-l-2",
        active ? "bg-ink-50 border-ink-900" : "border-transparent"
      ].join(" ")}
    >
      <div className="text-sm text-ink-800 truncate font-medium">
        {ch.kind === "dm" ? "@" : ch.kind === "program" ? "#" : "✉ "}
        {ch.title}
      </div>
      <div className="text-[10px] text-ink-400 truncate">
        {formatTime(ch.lastMessageAt)}
      </div>
    </button>
  );
}
