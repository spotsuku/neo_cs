"use client";

// 画面右下に常駐するチャットウィジェット。
// - TopNav の 💬 ボタンが window event "chat:toggle" を発火 → このコンポーネントが開閉
// - external ロールには表示しない / /chat ページ上では非表示（フル画面と重複するため）
// - 初回展開時にだけチャンネル一覧を読み込む（lazy）

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchMe } from "@/lib/auth/me-client";
import { useActiveMembers } from "@/lib/hooks/useActiveMembers";
import {
  ensureDmAction,
  listChannelsAction,
  listMessagesAction,
  postMessageAction
} from "@/app/chat/actions";
import type { ChatChannel, ChatMessage } from "@/lib/repository/types";

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
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `${hh}:${mm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export function ChatDock() {
  const pathname = usePathname() ?? "";
  const [allowed, setAllowed] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [showNewDm, setShowNewDm] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { names: assigneeOptions } = useActiveMembers();

  // /api/me で表示可否と表示名を解決
  useEffect(() => {
    let cancelled = false;
    fetchMe().then((data) => {
      if (cancelled || !data?.user) return;
      const role = data.user.role;
      setAllowed(role !== "external");
      setCurrentUserName(data.user.name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // TopNav の 💬 から発火する開閉イベント
  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener("chat:toggle", toggle);
    return () => window.removeEventListener("chat:toggle", toggle);
  }, []);

  // 初回展開時にチャンネル一覧を取得
  useEffect(() => {
    if (!open || loaded || !allowed) return;
    (async () => {
      const list = await listChannelsAction();
      setChannels(list);
      setLoaded(true);
    })();
  }, [open, loaded, allowed]);

  // メッセージ末尾へスクロール
  useEffect(() => {
    if (!open || !selectedId) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, selectedId]);

  if (!allowed) return null;
  if (pathname.startsWith("/chat")) return null;

  const selectChannel = async (id: string) => {
    setSelectedId(id);
    setMessages([]);
    const next = await listMessagesAction(id);
    setMessages(next);
  };

  const backToList = () => {
    setSelectedId(null);
    setMessages([]);
  };

  const parseMentions = (body: string): string[] => {
    const found = new Set<string>();
    for (const name of assigneeOptions) {
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
      const next = await listChannelsAction();
      setChannels(next);
    } finally {
      setBusy(false);
    }
  };

  const startDmWith = async (otherName: string) => {
    if (otherName === currentUserName) return;
    const ch = await ensureDmAction(otherName);
    setShowNewDm(false);
    const next = await listChannelsAction();
    setChannels(next);
    selectChannel(ch.id);
  };

  const selected = selectedId ? channels.find((c) => c.id === selectedId) : null;
  const dmCandidates = assigneeOptions.filter((n) => n !== currentUserName);

  const grouped = {
    dm: channels.filter((c) => c.kind === "dm"),
    program: channels.filter((c) => c.kind === "program"),
    email_thread: channels.filter((c) => c.kind === "email_thread")
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      aria-live="polite"
      aria-hidden={!open}
    >
      {open && (
        <div className="w-[360px] h-[540px] rounded-2xl border border-ink-100 bg-white shadow-liquid-lg flex flex-col overflow-hidden">
          {/* ヘッダー */}
          <div className="border-b border-ink-100 px-3 py-2 flex items-center gap-2">
            {selected ? (
              <>
                <button
                  onClick={backToList}
                  className="w-7 h-7 rounded-full hover:bg-ink-50 flex items-center justify-center text-ink-600"
                  aria-label="一覧へ戻る"
                  title="一覧へ戻る"
                >
                  ←
                </button>
                <span
                  className={[
                    "px-1.5 py-0.5 rounded border text-[10px] font-medium",
                    KIND_COLOR[selected.kind]
                  ].join(" ")}
                >
                  {KIND_LABEL[selected.kind]}
                </span>
                <h2 className="text-sm font-semibold text-ink-900 truncate flex-1">
                  {selected.title}
                </h2>
              </>
            ) : (
              <>
                <span className="text-base">💬</span>
                <h2 className="text-sm font-semibold text-ink-900 flex-1">チャット</h2>
                <Link
                  href="/chat"
                  className="text-[11px] text-ink-500 hover:text-ink-700"
                  title="フル画面で開く"
                >
                  ⤢
                </Link>
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full hover:bg-ink-50 flex items-center justify-center text-ink-600"
              aria-label="閉じる"
              title="閉じる"
            >
              ✕
            </button>
          </div>

          {/* 本体 */}
          {!loaded ? (
            <div className="flex-1 flex items-center justify-center text-xs text-ink-400">
              読み込み中…
            </div>
          ) : selected ? (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-ink-50/30">
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
                        className={["flex gap-2", mine ? "justify-end" : "justify-start"].join(" ")}
                      >
                        {!mine && (
                          <div className="w-6 h-6 rounded-full bg-ink-200 text-[10px] flex items-center justify-center text-ink-700 font-medium shrink-0">
                            {m.authorName.slice(0, 1)}
                          </div>
                        )}
                        <div className={["max-w-[78%]", mine ? "text-right" : ""].join(" ")}>
                          <div className="flex items-center gap-2 text-[10px] text-ink-500 mb-0.5">
                            {!mine && <span className="font-medium text-ink-700">{m.authorName}</span>}
                            <span>{formatTime(m.createdAt)}</span>
                          </div>
                          <div
                            className={[
                              "inline-block px-3 py-1.5 rounded-2xl text-sm whitespace-pre-wrap break-words",
                              mine
                                ? "bg-brand-blue text-white rounded-tr-sm"
                                : "bg-white border border-ink-100 text-ink-800 rounded-tl-sm"
                            ].join(" ")}
                          >
                            {m.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="border-t border-ink-100 p-2">
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
                    placeholder="メッセージ（⌘ + Enter で送信）"
                    className="flex-1 resize-none rounded-lg border border-ink-200 px-2 py-1.5 text-sm focus:outline-none focus:border-brand-blue"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || busy}
                    className="self-end px-3 py-1.5 rounded-lg bg-ink-900 text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    送信
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <DockSection
                title="DM"
                actionLabel={showNewDm ? "閉じる" : "＋ 新規"}
                onAction={() => setShowNewDm((s) => !s)}
              >
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
                  <DockChannelRow key={c.id} ch={c} onClick={() => selectChannel(c.id)} />
                ))}
              </DockSection>
              <DockSection title="事業部">
                {grouped.program.map((c) => (
                  <DockChannelRow key={c.id} ch={c} onClick={() => selectChannel(c.id)} />
                ))}
              </DockSection>
              <DockSection title="メールスレッド">
                {grouped.email_thread.slice(0, 20).map((c) => (
                  <DockChannelRow key={c.id} ch={c} onClick={() => selectChannel(c.id)} />
                ))}
              </DockSection>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DockSection({
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
        <h3 className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
          {title}
        </h3>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-[11px] text-brand-blue hover:underline">
            {actionLabel}
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function DockChannelRow({ ch, onClick }: { ch: ChatChannel; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-ink-50 border-l-2 border-transparent"
    >
      <div className="text-sm text-ink-800 truncate font-medium">
        {ch.kind === "dm" ? "@" : ch.kind === "program" ? "#" : "✉ "}
        {ch.title}
      </div>
      <div className="text-[10px] text-ink-400 truncate">{formatTime(ch.lastMessageAt)}</div>
    </button>
  );
}
