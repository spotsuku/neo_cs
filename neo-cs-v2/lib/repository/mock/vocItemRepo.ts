// VOC mock リポジトリ
// 起動時 seed: 全 SurveyResponse / MeetingLog / WeeklyReview の自由記述を
// extractVocCandidates でスキャンして status="open" として登録

import { surveyResponses } from "@/lib/mock/surveys";
import { meetingLogs } from "@/lib/mock/entities";
import { weeklyReviews } from "@/lib/mock/weekly";
import { extractVocCandidates, type VocSourceTextInput } from "@/lib/domain/voc/voc";
import { DEFAULT_ORG_ID } from "../types";
import type {
  VocComment,
  VocItemCreateInput,
  VocItemFilter,
  VocItemRecord,
  VocItemRepo,
  VocPriority,
  VocStatus
} from "../types";

const TODAY = "2026-04-24T09:00:00Z";

function genId(): string {
  return `voc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSeedInputs(): VocSourceTextInput[] {
  const out: VocSourceTextInput[] = [];

  // SurveyResponse: answers 内 string value 全部
  for (const r of surveyResponses) {
    for (const a of r.answers) {
      if (typeof a.value !== "string" || a.value.length < 5) continue;
      out.push({
        sourceType: "survey_response",
        sourceId: r.id,
        text: a.value,
        contractId: undefined,
        companyId: r.companyId
      });
    }
  }

  // MeetingLog: summary / good / more / next を 1 つずつ
  for (const m of meetingLogs) {
    for (const text of [m.summary, m.good, m.more, m.next].filter(
      (s): s is string => typeof s === "string" && s.length >= 5
    )) {
      out.push({
        sourceType: "meeting_log",
        sourceId: m.id,
        text,
        companyId: m.companyId
      });
    }
  }

  // WeeklyReview: good / more / nextActions[].text
  for (const w of weeklyReviews) {
    for (const text of [w.good, w.more].filter(
      (s): s is string => typeof s === "string" && s.length >= 5
    )) {
      out.push({
        sourceType: "weekly_review",
        sourceId: w.id,
        text,
        companyId: w.companyId
      });
    }
    for (const n of w.nextActions) {
      if (typeof n.text === "string" && n.text.length >= 5) {
        out.push({
          sourceType: "weekly_review",
          sourceId: w.id,
          text: n.text,
          companyId: w.companyId
        });
      }
    }
  }

  return out;
}

// 拡張系キーワードを含むテストデータが mock seed に少ないため、検知を視認できる
// 程度のシードを差し込む (実運用では surveyResponses 等から自然に拾われる想定)
const HAND_SEEDED: VocItemRecord[] = [
  // ── 未対応 (open) ─────────────────────────────
  {
    id: "voc-seed-1",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "survey_response",
    sourceId: "sr-c-aeon-q1-1",
    contractId: "k-aeon-academia",
    companyId: "c-aeon",
    excerpt: "ダッシュボードに前年同月比のグラフが欲しい。経営層への報告に使いたい。",
    tags: ["ui_improvement", "feature_request"],
    status: "open",
    priority: "high",
    comments: [],
    createdAt: "2026-05-02T09:00:00Z",
    updatedAt: "2026-05-02T09:00:00Z"
  },
  {
    id: "voc-seed-2",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "meeting_log",
    sourceId: "ml-c-fukugin-202605",
    contractId: "k-fukugin-commu",
    companyId: "c-fukugin",
    excerpt: "ログイン時の二要素認証を任意で有効化できるようにしてほしい。",
    tags: ["security", "feature_request"],
    status: "open",
    priority: "med",
    comments: [],
    createdAt: "2026-05-01T11:00:00Z",
    updatedAt: "2026-05-01T11:00:00Z"
  },
  {
    id: "voc-seed-3",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "weekly_review",
    sourceId: "w-c-mizuho-2026-w17",
    companyId: "c-mizuho",
    excerpt: "CSV エクスポートに UTF-8 BOM を入れる/入れないのオプションが欲しい。",
    tags: ["integration"],
    status: "open",
    priority: "low",
    comments: [],
    createdAt: "2026-04-28T08:00:00Z",
    updatedAt: "2026-04-28T08:00:00Z"
  },

  // ── 対応中 (in_progress) ───────────────────────
  {
    id: "voc-seed-4",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "weekly_review",
    sourceId: "w-c-aeon-academia-2026-04-13",
    contractId: "k-aeon-academia",
    companyId: "c-aeon",
    excerpt: "ダッシュボードの担当者切替がやりにくい。業界別の進捗フィルタが欲しい。",
    tags: ["ui_improvement", "feature_request"],
    status: "in_progress",
    priority: "med",
    assignedTo: "u-furuno",
    comments: [
      {
        id: "vc-1",
        authorUserId: "u-furuno",
        body: "T-60 で価値レビュー時にもう一度ヒアリング予定",
        createdAt: "2026-04-22T10:00:00Z"
      }
    ],
    createdAt: "2026-04-15T09:00:00Z",
    updatedAt: "2026-04-22T10:00:00Z",
    triagedBy: "u-furuno",
    triagedAt: "2026-04-22T10:00:00Z"
  },
  {
    id: "voc-seed-5",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "meeting_log",
    sourceId: "ml-c-fukugin-202604",
    contractId: "k-fukugin-commu",
    companyId: "c-fukugin",
    excerpt: "Slack 連携で AI抽出 通知が欲しい、Channel別に分けてほしい。",
    tags: ["integration", "feature_request"],
    status: "in_progress",
    priority: "high",
    assignedTo: "u-miki",
    comments: [
      {
        id: "vc-2",
        authorUserId: "u-miki",
        body: "PdM と工数見積もり中。来週仕様レビュー予定。",
        createdAt: "2026-04-25T14:00:00Z"
      }
    ],
    createdAt: "2026-04-12T09:00:00Z",
    updatedAt: "2026-04-25T14:00:00Z",
    triagedBy: "u-miki",
    triagedAt: "2026-04-18T09:00:00Z"
  },
  {
    id: "voc-seed-6",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "survey_response",
    sourceId: "sr-c-mufg-q1-2",
    companyId: "c-mufg",
    excerpt: "宿題管理の通知メールが届かないことがある。Slackと併用したい。",
    tags: ["bug", "integration"],
    status: "in_progress",
    priority: "high",
    assignedTo: "u-furuno",
    comments: [],
    createdAt: "2026-04-20T09:00:00Z",
    updatedAt: "2026-04-23T09:00:00Z",
    triagedBy: "u-furuno",
    triagedAt: "2026-04-23T09:00:00Z"
  },

  // ── 完了 (done) ───────────────────────────────
  {
    id: "voc-seed-7",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "weekly_review",
    sourceId: "w-c-smbc-2026-w14",
    companyId: "c-smbc",
    excerpt: "ファシリテーター変更後に質が向上した。継続してほしい。",
    tags: ["praise"],
    status: "done",
    priority: "low",
    assignedTo: "u-miki",
    comments: [
      {
        id: "vc-3",
        authorUserId: "u-miki",
        body: "本人へフィードバック共有済。次期も継続アサイン決定。",
        createdAt: "2026-04-30T10:00:00Z"
      }
    ],
    createdAt: "2026-04-08T09:00:00Z",
    updatedAt: "2026-04-30T10:00:00Z",
    triagedBy: "u-miki",
    triagedAt: "2026-04-10T09:00:00Z",
    shippedAt: "2026-04-30T10:00:00Z"
  },
  {
    id: "voc-seed-8",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "meeting_log",
    sourceId: "ml-c-aeon-202603",
    contractId: "k-aeon-academia",
    companyId: "c-aeon",
    excerpt: "オンライン参加用のリンクをメールで送ってほしい。",
    tags: ["feature_request"],
    status: "done",
    priority: "med",
    assignedTo: "u-furuno",
    linkedPrUrl: "https://github.com/example/neo-cs/pull/142",
    comments: [],
    createdAt: "2026-03-15T09:00:00Z",
    updatedAt: "2026-04-18T09:00:00Z",
    triagedBy: "u-furuno",
    triagedAt: "2026-03-20T09:00:00Z",
    shippedAt: "2026-04-18T09:00:00Z",
    customerNotifiedAt: "2026-04-19T09:00:00Z"
  },

  // ── 対応なし (wontfix) ─────────────────────────
  {
    id: "voc-seed-9",
    organizationId: DEFAULT_ORG_ID,
    sourceType: "survey_response",
    sourceId: "sr-c-mizuho-q1-3",
    companyId: "c-mizuho",
    excerpt: "ダークモードに対応してほしい。",
    tags: ["ui_improvement"],
    status: "wontfix",
    priority: "low",
    comments: [
      {
        id: "vc-4",
        authorUserId: "u-furuno",
        body: "プロダクト方針として当面ライト固定。優先度低のためクローズ。",
        createdAt: "2026-04-15T09:00:00Z"
      }
    ],
    createdAt: "2026-04-05T09:00:00Z",
    updatedAt: "2026-04-15T09:00:00Z"
  }
];

function seedVocItems(): VocItemRecord[] {
  const candidates = extractVocCandidates(buildSeedInputs(), TODAY);
  const auto: VocItemRecord[] = candidates.map((c) => ({
    id: `voc-${c.sourceType}-${c.sourceId}-${c.matchedKeywords[0] ?? "x"}`,
    organizationId: DEFAULT_ORG_ID,
    sourceType: c.sourceType,
    sourceId: c.sourceId,
    contractId: c.contractId,
    companyId: c.companyId,
    excerpt: c.excerpt,
    tags: c.suggestedTags,
    status: "open" as VocStatus,
    priority: "med" as VocPriority,
    comments: [],
    createdAt: c.detectedAt,
    updatedAt: c.detectedAt
  }));
  // hand seeded を先頭に
  return [...HAND_SEEDED, ...auto];
}

import { useGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";
// v2: 4 値ステータス (open/in_progress/done/wontfix) への移行に伴い key を bump。
// 旧キー (__vocItemStore) のキャッシュは破棄される。
const store = useGlobalStore<VocItemRecord[]>("__vocItemStore_v2", seedVocItems);

function clone(v: VocItemRecord): VocItemRecord {
  return {
    ...v,
    tags: [...v.tags],
    comments: v.comments.map((c) => ({ ...c }))
  };
}

async function recordVocMutation(
  action: "create" | "update" | "delete",
  id: string,
  before: VocItemRecord | undefined,
  after: VocItemRecord | undefined,
  organizationId: string | null
): Promise<void> {
  await mockMutate({
    entityType: "voc_items",
    entityId: id,
    action,
    before,
    after,
    organizationId
  });
}

function applyFilter(list: VocItemRecord[], f?: VocItemFilter): VocItemRecord[] {
  if (!f) return list;
  return list.filter((v) => {
    if (f.organizationId && v.organizationId !== f.organizationId) return false;
    if (f.status) {
      const arr = Array.isArray(f.status) ? f.status : [f.status];
      if (!arr.includes(v.status)) return false;
    }
    if (f.priority && v.priority !== f.priority) return false;
    if (f.tag && !v.tags.includes(f.tag)) return false;
    if (f.contractId && v.contractId !== f.contractId) return false;
    if (f.companyId && v.companyId !== f.companyId) return false;
    if (f.unNotifiedOnly && v.notifiedAt) return false;
    return true;
  });
}

const PRIORITY_RANK: Record<VocPriority, number> = { high: 3, med: 2, low: 1 };

function findIdx(id: string): number {
  return store.findIndex((v) => v.id === id);
}

export const mockVocItemRepo: VocItemRepo = {
  async list(filter) {
    return applyFilter(store, filter)
      .sort((a, b) => {
        const r = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (r !== 0) return r;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .map(clone);
  },
  async getById(id) {
    const v = store.find((x) => x.id === id);
    return v ? clone(v) : null;
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: VocItemRecord = {
      ...input,
      tags: [...input.tags],
      id: input.id ?? genId(),
      comments: [],
      createdAt: now,
      updatedAt: now
    };
    store.push(created);
    await recordVocMutation("create", created.id, undefined, created, created.organizationId);
    return clone(created);
  },
  async setStatus(id, opts) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    const now = new Date().toISOString();
    const next: VocItemRecord = { ...store[i], status: opts.status, updatedAt: now };
    if (opts.status === "in_progress") {
      next.triagedBy = next.triagedBy ?? opts.actorUserId;
      next.triagedAt = next.triagedAt ?? now;
    }
    if (opts.status === "done") {
      next.shippedAt = opts.shippedAt ?? now;
      if (opts.customerNotifiedAt) next.customerNotifiedAt = opts.customerNotifiedAt;
    }
    store[i] = next;
    await recordVocMutation("update", id, before, next, next.organizationId);
    return clone(next);
  },
  async setPriority(id, priority) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    store[i] = { ...store[i], priority, updatedAt: new Date().toISOString() };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
    return clone(store[i]);
  },
  async setTags(id, tags) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    const dedup = Array.from(new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)));
    store[i] = { ...store[i], tags: dedup, updatedAt: new Date().toISOString() };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
    return clone(store[i]);
  },
  async setLinkedPrUrl(id, url) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    store[i] = { ...store[i], linkedPrUrl: url, updatedAt: new Date().toISOString() };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
    return clone(store[i]);
  },
  async setAssignedTo(id, userId) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    store[i] = { ...store[i], assignedTo: userId, updatedAt: new Date().toISOString() };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
    return clone(store[i]);
  },
  async appendComment(id, comment) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`VocItem not found: ${id}`);
    const before = clone(store[i]);
    const c: VocComment = {
      id: `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...comment,
      createdAt: new Date().toISOString()
    };
    store[i] = {
      ...store[i],
      comments: [...store[i].comments, c],
      updatedAt: new Date().toISOString()
    };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
    return clone(store[i]);
  },
  async markNotified(id, notifiedAt) {
    const i = findIdx(id);
    if (i < 0) return;
    const before = clone(store[i]);
    store[i] = {
      ...store[i],
      notifiedAt: notifiedAt ?? new Date().toISOString()
    };
    await recordVocMutation("update", id, before, store[i], store[i].organizationId);
  }
};
