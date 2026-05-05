// chats (mock 実装)
//
// DM / 事業部 / メールスレッドを統合したチャットの in-memory 実装。
//
// 設計:
//   - dm / program 用のチャンネル + メッセージは本ファイルでメモリ保持
//   - email_thread 種別は emailThreads から動的に投影し、メッセージは
//     internalThreadComments と同一データソースを読み書きする
//     （受信箱画面の社内チャットと完全に同期）
//   - 本番（supabase）実装では chat_channels.kind='email_thread' 行を
//     email_threads と 1:1 で持ち、chat_messages に統合される

import type {
  ChatChannel,
  ChatMessage,
  ChatRepo,
  ProductCode
} from "../types";
import { DEFAULT_ORG_ID } from "../types";
import {
  internalThreadComments,
  emailThreads,
  type InternalThreadComment
} from "@/lib/mock/email";

type DmRow = {
  id: string;
  members: [string, string];
  lastMessageAt: string;
};

type ProgramRow = {
  id: string;
  productCode: ProductCode;
  title: string;
  lastMessageAt: string;
};

const dmStore: DmRow[] = [
  { id: "dm-furuno-matsuda", members: ["古野", "松田"], lastMessageAt: "2026-04-24T10:20:00+09:00" },
  { id: "dm-furuno-miki", members: ["古野", "三木"], lastMessageAt: "2026-04-23T18:45:00+09:00" },
  { id: "dm-furuno-tanaka", members: ["古野", "田中"], lastMessageAt: "2026-04-22T09:15:00+09:00" }
];

const programStore: ProgramRow[] = [
  { id: "prog-academia", productCode: "academia", title: "ACADEMIA 事業部", lastMessageAt: "2026-04-24T09:30:00+09:00" },
  { id: "prog-hyogikai", productCode: "hyogikai", title: "評議会 事業部", lastMessageAt: "2026-04-23T17:00:00+09:00" },
  { id: "prog-aiken", productCode: "aiken", title: "AIKEN 事業部", lastMessageAt: "2026-04-24T08:45:00+09:00" },
  { id: "prog-commu", productCode: "commu", title: "コミュマネ 事業部", lastMessageAt: "2026-04-22T14:00:00+09:00" }
];

const messageStore: ChatMessage[] = [
  { id: "cm-1", channelId: "dm-furuno-matsuda", authorName: "松田", body: "FFGの更新打診、来週水曜のアポでいけそうです。資料は私で準備します。", mentions: [], createdAt: "2026-04-24T10:15:00+09:00" },
  { id: "cm-2", channelId: "dm-furuno-matsuda", authorName: "古野", body: "助かります。先方の温度感、過去メモまとめて共有しますね。", mentions: [], createdAt: "2026-04-24T10:20:00+09:00" },
  { id: "cm-3", channelId: "dm-furuno-miki", authorName: "三木", body: "福岡市の引き継ぎ、明日30分もらえますか？", mentions: [], createdAt: "2026-04-23T18:40:00+09:00" },
  { id: "cm-4", channelId: "dm-furuno-miki", authorName: "古野", body: "OKです。15時はいかがでしょう。", mentions: [], createdAt: "2026-04-23T18:45:00+09:00" },
  { id: "cm-5", channelId: "dm-furuno-tanaka", authorName: "古野", body: "AIKEN第3回の参加企業リスト、最新版どこにありますか？", mentions: [], createdAt: "2026-04-22T09:15:00+09:00" },
  { id: "cm-6", channelId: "prog-academia", authorName: "松田", body: "@古野 第15回講義のゲスト枠、佐藤課長以外でも可とのこと。代替候補リストを共有します。", mentions: ["古野"], createdAt: "2026-04-24T09:30:00+09:00" },
  { id: "cm-7", channelId: "prog-academia", authorName: "古野", body: "ありがとうございます。受信箱の et-1 に紐付けて返信します。", mentions: [], createdAt: "2026-04-24T09:35:00+09:00" },
  { id: "cm-8", channelId: "prog-aiken", authorName: "田中", body: "Basic 第2回の出席率が想定より高め。次回キャンプ枠の上限を見直したいです。", mentions: [], createdAt: "2026-04-24T08:45:00+09:00" },
  { id: "cm-9", channelId: "prog-hyogikai", authorName: "三木", body: "5月定例の会場、今年は変更ないですよね？", mentions: [], createdAt: "2026-04-23T17:00:00+09:00" },
  { id: "cm-10", channelId: "prog-commu", authorName: "古野", body: "ふくぎん契約書の押印完了確認、et-2 で進行中です。", mentions: [], createdAt: "2026-04-22T14:00:00+09:00" }
];

function dmToChannel(d: DmRow, organizationId: string): ChatChannel {
  return {
    id: d.id,
    organizationId,
    kind: "dm",
    title: d.members.join(" / "),
    members: d.members.slice(),
    lastMessageAt: d.lastMessageAt
  };
}

function programToChannel(p: ProgramRow, organizationId: string): ChatChannel {
  return {
    id: p.id,
    organizationId,
    kind: "program",
    title: p.title,
    productCode: p.productCode,
    lastMessageAt: p.lastMessageAt
  };
}

function emailThreadChannels(organizationId: string): ChatChannel[] {
  return emailThreads.map((t) => {
    const last =
      internalThreadComments
        .filter((c) => c.threadId === t.id)
        .map((c) => c.createdAt)
        .sort()
        .at(-1) ?? t.lastMessageAt;
    return {
      id: `et-channel-${t.id}`,
      organizationId,
      kind: "email_thread" as const,
      title: t.subject,
      emailThreadId: t.id,
      lastMessageAt: last
    };
  });
}

function commentToMessage(c: InternalThreadComment, channelId: string): ChatMessage {
  return {
    id: `cm-from-ic-${c.id}`,
    channelId,
    authorName: c.authorName,
    body: c.body,
    mentions: c.mentions,
    createdAt: c.createdAt
  };
}

export const mockChatRepo: ChatRepo = {
  async listChannels({ organizationId, userName }) {
    const orgId = organizationId || DEFAULT_ORG_ID;
    const dms = dmStore
      .filter((d) => d.members.includes(userName))
      .map((d) => {
        // タイトルを「相手の名前」で表現（自分以外）
        const other = d.members.find((m) => m !== userName) ?? d.members[0];
        return { ...dmToChannel(d, orgId), title: other };
      });
    const progs = programStore.map((p) => programToChannel(p, orgId));
    const ets = emailThreadChannels(orgId);
    return [...dms, ...progs, ...ets].sort((a, b) =>
      a.lastMessageAt < b.lastMessageAt ? 1 : -1
    );
  },

  async listMessages(channelId) {
    if (channelId.startsWith("et-channel-")) {
      const tid = channelId.replace(/^et-channel-/, "");
      return internalThreadComments
        .filter((c) => c.threadId === tid)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map((c) => commentToMessage(c, channelId));
    }
    return messageStore
      .filter((m) => m.channelId === channelId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },

  async postMessage({ channelId, authorName, body, mentions }) {
    const now = new Date().toISOString();

    if (channelId.startsWith("et-channel-")) {
      const tid = channelId.replace(/^et-channel-/, "");
      const ic: InternalThreadComment = {
        id: `ic-mock-${Date.now()}`,
        threadId: tid,
        authorName,
        body,
        mentions,
        createdAt: now
      };
      internalThreadComments.push(ic);
      const t = emailThreads.find((x) => x.id === tid);
      if (t) t.lastMessageAt = now.slice(0, 10);
      return commentToMessage(ic, channelId);
    }

    const msg: ChatMessage = {
      id: `cm-mock-${Date.now()}`,
      channelId,
      authorName,
      body,
      mentions,
      createdAt: now
    };
    messageStore.push(msg);
    const dm = dmStore.find((d) => d.id === channelId);
    if (dm) dm.lastMessageAt = now;
    const pg = programStore.find((p) => p.id === channelId);
    if (pg) pg.lastMessageAt = now;
    return msg;
  },

  async ensureDm({ organizationId, userA, userB }) {
    const orgId = organizationId || DEFAULT_ORG_ID;
    const exist = dmStore.find(
      (d) => d.members.includes(userA) && d.members.includes(userB)
    );
    if (exist) {
      const other = exist.members.find((m) => m !== userA) ?? exist.members[0];
      return { ...dmToChannel(exist, orgId), title: other };
    }
    const created: DmRow = {
      id: `dm-${userA}-${userB}-${Date.now()}`,
      members: [userA, userB],
      lastMessageAt: new Date().toISOString()
    };
    dmStore.push(created);
    return { ...dmToChannel(created, orgId), title: userB };
  }
};
