// user_notifications (Supabase 実装)
// マイグレーション: supabase/migrations/0041_user_notifications.sql

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import type {
  UserNotification,
  UserNotificationCreateInput,
  UserNotificationRepo,
  NotificationCategory
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  user_id: string | null;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link_href: string | null;
  related_company_id: string | null;
  related_contract_id: string | null;
  source_type: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
};

function toNotification(r: Row): UserNotification {
  return {
    id: r.id,
    organizationId: r.organization_id,
    userId: r.user_id ?? undefined,
    category: r.category,
    title: r.title,
    body: r.body ?? undefined,
    linkHref: r.link_href ?? undefined,
    relatedCompanyId: r.related_company_id ?? undefined,
    relatedContractId: r.related_contract_id ?? undefined,
    sourceType: r.source_type ?? undefined,
    sourceId: r.source_id ?? undefined,
    readAt: r.read_at ?? undefined,
    createdAt: r.created_at
  };
}

export const supabaseUserNotificationRepo: UserNotificationRepo = {
  async list(filter) {
    const sb = getServiceClient();
    let q = sb
      .from("user_notifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter.organizationId) q = q.eq("organization_id", filter.organizationId);
    if (filter.userId) {
      // 自分宛 + ブロードキャスト両方
      q = q.or(`user_id.eq.${filter.userId},user_id.is.null`);
    }
    if (filter.category) q = q.eq("category", filter.category);
    if (filter.unreadOnly) q = q.is("read_at", null);
    if (filter.limit) q = q.limit(filter.limit);
    const { data, error } = await q;
    if (error) throw new Error(`user_notifications.list: ${error.message}`);
    return (data ?? []).map((r: Row) => toNotification(r));
  },

  async create(input: UserNotificationCreateInput) {
    const sb = getServiceClient();
    // dedup: (user_id, source_type, source_id) で既存があれば返す
    if (input.userId && input.sourceType && input.sourceId) {
      const { data: existing } = await sb
        .from("user_notifications")
        .select("*")
        .eq("user_id", input.userId)
        .eq("source_type", input.sourceType)
        .eq("source_id", input.sourceId)
        .maybeSingle();
      if (existing) return toNotification(existing as Row);
    }
    const { data, error } = await sb
      .from("user_notifications")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId ?? null,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        link_href: input.linkHref ?? null,
        related_company_id: input.relatedCompanyId ?? null,
        related_contract_id: input.relatedContractId ?? null,
        source_type: input.sourceType ?? null,
        source_id: input.sourceId ?? null
      })
      .select()
      .single();
    if (error) throw new Error(`user_notifications.create: ${error.message}`);
    return toNotification(data as Row);
  },

  async markRead(id, userId) {
    const sb = getServiceClient();
    const { error } = await sb
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .or(`user_id.eq.${userId},user_id.is.null`);
    if (error) throw new Error(`user_notifications.markRead: ${error.message}`);
  },

  async markAllRead(userId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .select("id");
    if (error) throw new Error(`user_notifications.markAllRead: ${error.message}`);
    return (data ?? []).length;
  },

  async countUnread(userId) {
    const sb = getServiceClient();
    const { count, error } = await sb
      .from("user_notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null)
      .or(`user_id.eq.${userId},user_id.is.null`);
    if (error) throw new Error(`user_notifications.countUnread: ${error.message}`);
    return count ?? 0;
  }
};
