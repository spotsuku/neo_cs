// AI 抽出 mock 実装
//
// 既存 mock (lib/mock/email.ts の aiExtractions 配列) を新スキーマに変換して
// in-memory ストアに格納。listByCompany / listByMe / markReviewed を提供する。
//
// 旧スキーマ (type=onboarding_task_done 等) → 新スキーマ (extraction_type) への
// マッピング:
//   onboarding_task_done / stakeholder_change → progress_signal
//   negative_signal                           → risk_signal
//   renewal_signal                            → churn_signal
//   next_action                               → meeting_request

import type {
  AiExtractionRepo,
  AiExtraction,
  AiExtractionType,
  AiExtractionListOpts
} from "../types";
import { DEFAULT_ORG_ID } from "../types";
import {
  aiExtractions as legacyExtractions,
  emailThreads as legacyThreads,
  type AiExtractionType as LegacyType
} from "@/lib/mock/email";
import { useGlobalStore } from "./_global-store";

const TYPE_MAP: Record<LegacyType, AiExtractionType> = {
  onboarding_task_done: "progress_signal",
  stakeholder_change: "progress_signal",
  negative_signal: "risk_signal",
  renewal_signal: "churn_signal",
  next_action: "meeting_request"
};

function seed(): AiExtraction[] {
  return legacyExtractions.map((x) => {
    const thread = legacyThreads.find((t) => t.id === x.threadId);
    const reviewed = x.status === "approved" || x.status === "rejected";
    return {
      id: x.id,
      organizationId: DEFAULT_ORG_ID,
      sourceType: "email" as const,
      sourceId: x.messageId,
      companyId: thread?.companyId,
      extractionType: TYPE_MAP[x.type],
      excerpt: x.suggestion,
      confidence: x.confidence,
      suggestedAction: x.suggestion,
      reviewed,
      reviewedAt: reviewed ? x.createdAt : undefined,
      reviewedBy: undefined,
      createdAt: x.createdAt
    };
  });
}

const store = useGlobalStore<AiExtraction[]>("__aiExtractionStore", seed);

function applyOpts(rows: AiExtraction[], opts?: AiExtractionListOpts): AiExtraction[] {
  let out = rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (opts?.unreviewedOnly) out = out.filter((r) => !r.reviewed);
  if (opts?.limit) out = out.slice(0, opts.limit);
  return out.map((r) => ({ ...r }));
}

export const mockAiExtractionRepo: AiExtractionRepo = {
  async listByCompany(companyId, opts) {
    return applyOpts(
      store.filter((r) => r.companyId === companyId),
      opts
    );
  },

  async listByMe(userId, opts) {
    // mock では assignee は人名文字列 (例 "古野")。emailThreads から
    // assignee=userId のスレッドを抜き出し、その sourceId (=email_messages.id)
    // が同スレッドに属する email source 抽出を集める。
    const myThreadIds = new Set(
      legacyThreads.filter((t) => t.assignee === userId).map((t) => t.id)
    );
    const myMessageIds = new Set(
      legacyExtractions
        .filter((x) => myThreadIds.has(x.threadId))
        .map((x) => x.messageId)
    );
    return applyOpts(
      store.filter(
        (r) => r.sourceType === "email" && myMessageIds.has(r.sourceId)
      ),
      opts
    );
  },

  async markReviewed(id, userId) {
    const idx = store.findIndex((r) => r.id === id);
    if (idx < 0) return;
    store[idx] = {
      ...store[idx],
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      reviewedBy: userId
    };
  }
};
