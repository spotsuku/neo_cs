// AI 抽出 Supabase リポジトリ
// マイグレーション: supabase/migrations/0031_email.sql
//
// listByCompany: 直接 company_id で絞る。
// listByMe: email source の sourceId (=email_messages.id) を、ユーザーが
//   担当する email_threads (assignee_user_id) に属するメッセージに限定する。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
import type {
  AiExtractionRepo,
  AiExtraction,
  AiExtractionListOpts,
  AiExtractionType,
  AiExtractionSourceType,
  AiExtractionReviewDecision
} from "../types";

type Row = {
  id: string;
  organization_id: string;
  source_type: AiExtractionSourceType;
  source_id: string;
  company_id: string | null;
  extraction_type: AiExtractionType;
  excerpt: string;
  confidence: number | string | null;
  suggested_action: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_decision: AiExtractionReviewDecision | null;
  created_at: string;
};

function toDomain(r: Row): AiExtraction {
  const conf =
    r.confidence === null || r.confidence === undefined
      ? undefined
      : typeof r.confidence === "string"
        ? Number(r.confidence)
        : r.confidence;
  return {
    id: r.id,
    organizationId: r.organization_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    companyId: r.company_id ?? undefined,
    extractionType: r.extraction_type,
    excerpt: r.excerpt,
    confidence: conf,
    suggestedAction: r.suggested_action ?? undefined,
    reviewed: r.reviewed,
    reviewedAt: r.reviewed_at ?? undefined,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewDecision: r.review_decision ?? undefined,
    createdAt: r.created_at
  };
}

export const supabaseAiExtractionRepo: AiExtractionRepo = {
  async listByCompany(companyId, opts?: AiExtractionListOpts) {
    const sb = getServiceClient();
    let q = sb
      .from("ai_extractions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (opts?.unreviewedOnly) q = q.eq("reviewed", false);
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`ai_extractions.byCompany: ${error.message}`);
    return (data ?? []).map((r) => toDomain(r as Row));
  },

  async listByMe(userId, opts?: AiExtractionListOpts) {
    const sb = getServiceClient();
    // 1. ユーザー担当の email_threads.id を集める
    const { data: threads, error: tErr } = await sb
      .from("email_threads")
      .select("id")
      .eq("assignee_user_id", userId);
    if (tErr) throw new Error(`email_threads.byAssignee: ${tErr.message}`);
    const threadIds = (threads ?? []).map((t) => t.id as string);
    if (threadIds.length === 0) return [];

    // 2. それらスレッドに属する email_messages.id を取得
    const { data: msgs, error: mErr } = await sb
      .from("email_messages")
      .select("id")
      .in("thread_id", threadIds);
    if (mErr) throw new Error(`email_messages.byThreads: ${mErr.message}`);
    const messageIds = (msgs ?? []).map((m) => m.id as string);
    if (messageIds.length === 0) return [];

    // 3. source_type='email' かつ source_id IN (...) で抽出
    let q = sb
      .from("ai_extractions")
      .select("*")
      .eq("source_type", "email")
      .in("source_id", messageIds)
      .order("created_at", { ascending: false });
    if (opts?.unreviewedOnly) q = q.eq("reviewed", false);
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`ai_extractions.byMe: ${error.message}`);
    return (data ?? []).map((r) => toDomain(r as Row));
  },

  async listLatestSuggestionsByThreads(threadIds, opts) {
    if (threadIds.length === 0) return [];
    const sb = getServiceClient();
    let q = sb
      .from("ai_extractions")
      .select("*")
      .eq("source_type", "email")
      .eq("extraction_type", "company_suggestion")
      .in("source_id", threadIds)
      .order("source_id", { ascending: true })
      .order("created_at", { ascending: false });
    if (opts?.unreviewedOnly) q = q.eq("reviewed", false);
    const { data, error } = await q;
    if (error) {
      throw new Error(`ai_extractions.latestSuggestionsByThreads: ${error.message}`);
    }
    // (source_id, created_at desc) で並んでいる → source_id ごとの先頭を採用
    const seen = new Set<string>();
    const out: AiExtraction[] = [];
    for (const row of (data ?? []) as Row[]) {
      if (seen.has(row.source_id)) continue;
      seen.add(row.source_id);
      out.push(toDomain(row));
    }
    return out;
  },

  async getById(id) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("ai_extractions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`ai_extractions.getById: ${error.message}`);
    return data ? toDomain(data as Row) : null;
  },

  async markReviewed(id, userId, decision) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("ai_extractions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const { data, error } = await sb
      .from("ai_extractions")
      .update({
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        review_decision: decision
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`ai_extractions.markReviewed: ${error.message}`);
    await runAfterWrite({
      entityType: "ai_extractions",
      entityId: id,
      before: before ? toDomain(before as Row) : undefined,
      after: toDomain(data as Row),
      action: "update",
      ctx
    });
  },

  async create(input) {
    const sb = getServiceClient();
    const id = `ax-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await sb
      .from("ai_extractions")
      .insert({
        id,
        organization_id: input.organizationId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        company_id: input.companyId ?? null,
        extraction_type: input.extractionType,
        excerpt: input.excerpt.slice(0, 2000),
        confidence: input.confidence ?? null,
        suggested_action: input.suggestedAction ?? null,
        reviewed: false
      })
      .select("*")
      .single();
    if (error) throw new Error(`ai_extractions.create: ${error.message}`);
    return toDomain(data as Row);
  }
};
