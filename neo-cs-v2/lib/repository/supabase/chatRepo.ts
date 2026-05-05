// chats (Supabase 実装) — 0025_chat.sql に対応
//
// 設計:
//   - chat_channels / chat_messages / chat_channel_members /
//     chat_message_mentions の4表で構成
//   - mentions は app_users.name で受け取り、書き込み時に user_id 解決
//   - DM の members は app_users.name の配列に解決
//   - kind='email_thread' チャンネルは初回アクセス時に upsert する責務を
//     呼び出し側に持たせる（アプリ層 / バッチで mock の emailThreads から
//     生成）。本リポジトリは「既に存在するもの」を読む

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type {
  ChatChannel,
  ChatMessage,
  ChatRepo,
  ChatChannelKind,
  ProductCode
} from "../types";

type ChannelRow = {
  id: string;
  organization_id: string;
  kind: ChatChannelKind;
  title: string | null;
  product_code: string | null;
  email_thread_ref: string | null;
  last_message_at: string;
};

type MessageRow = {
  id: string;
  channel_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};

async function resolveUserNameMap(
  userIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("app_users")
    .select("id,name")
    .in("id", userIds);
  if (error) throw new Error(`app_users.lookup: ${error.message}`);
  for (const r of data ?? []) out.set(r.id as string, r.name as string);
  return out;
}

async function resolveUserIdByName(
  organizationId: string,
  name: string
): Promise<string | null> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("app_users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`app_users.byName: ${error.message}`);
  return data ? (data.id as string) : null;
}

async function channelToDomain(row: ChannelRow): Promise<ChatChannel> {
  const base: ChatChannel = {
    id: row.id,
    organizationId: row.organization_id,
    kind: row.kind,
    title: row.title ?? "",
    productCode: (row.product_code as ProductCode | null) ?? undefined,
    emailThreadId: row.email_thread_ref ?? undefined,
    lastMessageAt: row.last_message_at
  };
  if (row.kind === "dm") {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("chat_channel_members")
      .select("user_id")
      .eq("channel_id", row.id);
    if (error) throw new Error(`chat_channel_members: ${error.message}`);
    const ids = (data ?? []).map((r) => r.user_id as string);
    const nameMap = await resolveUserNameMap(ids);
    base.members = ids.map((id) => nameMap.get(id) ?? id);
  }
  return base;
}

export const supabaseChatRepo: ChatRepo = {
  async listChannels({ organizationId, userName }) {
    const sb = getServiceClient();
    const userId = await resolveUserIdByName(organizationId, userName);

    // 1. organization 内の program / email_thread をすべて取得
    const { data: orgChannels, error: e1 } = await sb
      .from("chat_channels")
      .select("*")
      .eq("organization_id", organizationId)
      .in("kind", ["program", "email_thread"])
      .order("last_message_at", { ascending: false });
    if (e1) throw new Error(`chat_channels.list: ${e1.message}`);

    // 2. 自分が所属する DM
    let dmChannels: ChannelRow[] = [];
    if (userId) {
      const { data: memberRows, error: e2 } = await sb
        .from("chat_channel_members")
        .select("channel_id")
        .eq("user_id", userId);
      if (e2) throw new Error(`chat_channel_members.list: ${e2.message}`);
      const ids = (memberRows ?? []).map((r) => r.channel_id as string);
      if (ids.length > 0) {
        const { data: dmRows, error: e3 } = await sb
          .from("chat_channels")
          .select("*")
          .in("id", ids)
          .eq("kind", "dm")
          .order("last_message_at", { ascending: false });
        if (e3) throw new Error(`chat_channels.dm: ${e3.message}`);
        dmChannels = (dmRows ?? []) as ChannelRow[];
      }
    }

    const all = [...dmChannels, ...((orgChannels ?? []) as ChannelRow[])];
    const out: ChatChannel[] = [];
    for (const r of all) out.push(await channelToDomain(r));
    return out.sort((a, b) =>
      a.lastMessageAt < b.lastMessageAt ? 1 : -1
    );
  },

  async listMessages(channelId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("chat_messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`chat_messages.list: ${error.message}`);
    const rows = (data ?? []) as MessageRow[];

    // メンション一括取得
    const messageIds = rows.map((r) => r.id);
    const mentionMap = new Map<string, string[]>();
    if (messageIds.length > 0) {
      const { data: mentionRows, error: me } = await sb
        .from("chat_message_mentions")
        .select("message_id,user_id")
        .in("message_id", messageIds);
      if (me) throw new Error(`chat_message_mentions.list: ${me.message}`);
      const userIds = Array.from(
        new Set([
          ...rows.map((r) => r.author_user_id),
          ...(mentionRows ?? []).map((r) => r.user_id as string)
        ])
      );
      const nameMap = await resolveUserNameMap(userIds);
      for (const m of mentionRows ?? []) {
        const arr = mentionMap.get(m.message_id as string) ?? [];
        const n = nameMap.get(m.user_id as string);
        if (n) arr.push(n);
        mentionMap.set(m.message_id as string, arr);
      }
      return rows.map((r) => ({
        id: r.id,
        channelId: r.channel_id,
        authorName: nameMap.get(r.author_user_id) ?? r.author_user_id,
        body: r.body,
        mentions: mentionMap.get(r.id) ?? [],
        createdAt: r.created_at
      }));
    }
    return [];
  },

  async postMessage({ channelId, authorName, body, mentions }) {
    const sb = getServiceClient();
    // 親チャンネルから org を取り、authorName を user_id に解決
    const { data: ch, error: ce } = await sb
      .from("chat_channels")
      .select("organization_id")
      .eq("id", channelId)
      .single();
    if (ce) throw new Error(`chat_channels.byId: ${ce.message}`);
    const orgId = ch.organization_id as string;
    const authorId = await resolveUserIdByName(orgId, authorName);
    if (!authorId) {
      throw new Error(`chat.postMessage: author "${authorName}" not found`);
    }

    const { data: inserted, error: ie } = await sb
      .from("chat_messages")
      .insert({
        channel_id: channelId,
        author_user_id: authorId,
        body
      })
      .select("*")
      .single();
    if (ie) throw new Error(`chat_messages.insert: ${ie.message}`);
    const msg = inserted as MessageRow;

    if (mentions.length > 0) {
      const ids: string[] = [];
      for (const n of mentions) {
        const id = await resolveUserIdByName(orgId, n);
        if (id) ids.push(id);
      }
      if (ids.length > 0) {
        const { error: me } = await sb
          .from("chat_message_mentions")
          .insert(ids.map((user_id) => ({ message_id: msg.id, user_id })));
        if (me) throw new Error(`chat_message_mentions.insert: ${me.message}`);
      }
    }

    return {
      id: msg.id,
      channelId: msg.channel_id,
      authorName,
      body: msg.body,
      mentions,
      createdAt: msg.created_at
    };
  },

  async ensureDm({ organizationId, userA, userB }) {
    const sb = getServiceClient();
    const idA = await resolveUserIdByName(organizationId, userA);
    const idB = await resolveUserIdByName(organizationId, userB);
    if (!idA || !idB) {
      throw new Error(
        `chat.ensureDm: user not found (${userA}=${idA}, ${userB}=${idB})`
      );
    }
    // 既存DM検索: A と B の両方が member になっている dm チャンネル
    const { data: aMembers, error: ae } = await sb
      .from("chat_channel_members")
      .select("channel_id")
      .eq("user_id", idA);
    if (ae) throw new Error(`chat_channel_members.A: ${ae.message}`);
    const aChannelIds = (aMembers ?? []).map((r) => r.channel_id as string);
    if (aChannelIds.length > 0) {
      const { data: bMembers, error: be } = await sb
        .from("chat_channel_members")
        .select("channel_id")
        .eq("user_id", idB)
        .in("channel_id", aChannelIds);
      if (be) throw new Error(`chat_channel_members.B: ${be.message}`);
      const candidateIds = (bMembers ?? []).map((r) => r.channel_id as string);
      if (candidateIds.length > 0) {
        const { data: ch, error: ce } = await sb
          .from("chat_channels")
          .select("*")
          .in("id", candidateIds)
          .eq("kind", "dm")
          .limit(1)
          .maybeSingle();
        if (ce) throw new Error(`chat_channels.dmFind: ${ce.message}`);
        if (ch) return await channelToDomain(ch as ChannelRow);
      }
    }

    // なければ作成
    const { data: created, error: ie } = await sb
      .from("chat_channels")
      .insert({
        organization_id: organizationId,
        kind: "dm",
        title: null
      })
      .select("*")
      .single();
    if (ie) throw new Error(`chat_channels.create: ${ie.message}`);
    const ch = created as ChannelRow;
    const { error: me } = await sb.from("chat_channel_members").insert([
      { channel_id: ch.id, user_id: idA },
      { channel_id: ch.id, user_id: idB }
    ]);
    if (me) throw new Error(`chat_channel_members.create: ${me.message}`);
    return await channelToDomain(ch);
  }
};
