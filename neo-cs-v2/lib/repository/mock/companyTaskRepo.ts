// 業務ToDo (company_tasks) mock リポジトリ
// onboarding_tasks とは別の汎用タスク。
// 純関数ロジックは lib/domain/task.ts に切り出し済。

import { DEFAULT_ORG_ID } from "../types";
import type {
  CompanyTask,
  CompanyTaskCreateInput,
  CompanyTaskFilter,
  CompanyTaskRepo,
  CompanyTaskUpdatePatch
} from "../types";
import { sortByDueAsc } from "@/lib/domain/task";

function genId(): string {
  return `ct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const TODAY = "2026-04-24";

// 動作確認用の seed
const seed: CompanyTask[] = [
  {
    id: "ct-seed-1",
    organizationId: DEFAULT_ORG_ID,
    companyId: "c-aeon",
    title: "次回定例の日程調整 (5月第2週)",
    description: "先方 山田さんへ候補3案を送付",
    category: "meeting_schedule",
    status: "pending",
    priority: "high",
    dueDate: "2026-04-26",
    assignedTo: "u-furuno",
    createdBy: "u-furuno",
    createdAt: "2026-04-22T09:00:00Z",
    updatedAt: "2026-04-22T09:00:00Z"
  },
  {
    id: "ct-seed-2",
    organizationId: DEFAULT_ORG_ID,
    companyId: "c-aeon",
    title: "前回提出物の不備確認",
    category: "document_check",
    status: "in_progress",
    priority: "med",
    dueDate: "2026-04-30",
    assignedTo: "u-furuno",
    createdBy: "u-furuno",
    createdAt: "2026-04-20T09:00:00Z",
    updatedAt: "2026-04-23T09:00:00Z"
  },
  {
    id: "ct-seed-3",
    organizationId: DEFAULT_ORG_ID,
    companyId: "c-fukugin",
    title: "新コース資料を送付",
    category: "material_send",
    status: "pending",
    priority: "urgent",
    dueDate: "2026-04-23", // overdue
    assignedTo: "u-miki",
    createdBy: "u-furuno",
    createdAt: "2026-04-15T09:00:00Z",
    updatedAt: "2026-04-15T09:00:00Z"
  },
  {
    id: "ct-seed-4",
    organizationId: DEFAULT_ORG_ID,
    companyId: "c-jrq",
    title: "更新打診のフォロー連絡",
    category: "followup",
    status: "done",
    priority: "med",
    dueDate: "2026-04-18",
    assignedTo: "u-furuno",
    createdBy: "u-furuno",
    completedAt: "2026-04-18T15:00:00Z",
    completedBy: "u-furuno",
    createdAt: "2026-04-10T09:00:00Z",
    updatedAt: "2026-04-18T15:00:00Z"
  }
];

const store: CompanyTask[] = seed.map((t) => ({ ...t }));

function clone(t: CompanyTask): CompanyTask {
  return { ...t };
}

function applyFilter(list: CompanyTask[], f?: CompanyTaskFilter): CompanyTask[] {
  if (!f) return list;
  return list.filter((t) => {
    if (f.organizationId && t.organizationId !== f.organizationId) return false;
    if (f.companyId && t.companyId !== f.companyId) return false;
    if (f.contractId && t.contractId !== f.contractId) return false;
    if (f.assignedTo && t.assignedTo !== f.assignedTo) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.status) {
      const arr = Array.isArray(f.status) ? f.status : [f.status];
      if (!arr.includes(t.status)) return false;
    }
    if (f.openOnly && t.status !== "pending" && t.status !== "in_progress") return false;
    if (f.overdueOnly) {
      if (!t.dueDate) return false;
      if (t.status !== "pending" && t.status !== "in_progress") return false;
      if (t.dueDate >= TODAY) return false;
    }
    if (f.dueOnOrBefore) {
      if (!t.dueDate) return false;
      if (t.status !== "pending" && t.status !== "in_progress") return false;
      if (t.dueDate > f.dueOnOrBefore) return false;
    }
    return true;
  });
}

function findIdx(id: string): number {
  return store.findIndex((t) => t.id === id);
}

export const mockCompanyTaskRepo: CompanyTaskRepo = {
  async list(filter) {
    return sortByDueAsc(applyFilter(store, filter)).map(clone);
  },
  async getById(id) {
    const t = store.find((x) => x.id === id);
    return t ? clone(t) : null;
  },
  async create(input) {
    const now = new Date().toISOString();
    const created: CompanyTask = {
      ...input,
      id: input.id ?? genId(),
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      status: input.status ?? "pending",
      createdAt: now,
      updatedAt: now
    };
    store.push(created);
    return clone(created);
  },
  async update(id, patch) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`CompanyTask not found: ${id}`);
    store[i] = { ...store[i], ...patch, updatedAt: new Date().toISOString() };
    return clone(store[i]);
  },
  async markDone(id, opts) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`CompanyTask not found: ${id}`);
    const now = new Date().toISOString();
    store[i] = {
      ...store[i],
      status: "done",
      completedAt: opts.completedAt ?? now,
      completedBy: opts.completedBy ?? store[i].assignedTo,
      updatedAt: now
    };
    return clone(store[i]);
  },
  async markSkipped(id) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`CompanyTask not found: ${id}`);
    store[i] = { ...store[i], status: "skipped", updatedAt: new Date().toISOString() };
    return clone(store[i]);
  },
  async markCancelled(id) {
    const i = findIdx(id);
    if (i < 0) throw new Error(`CompanyTask not found: ${id}`);
    store[i] = { ...store[i], status: "cancelled", updatedAt: new Date().toISOString() };
    return clone(store[i]);
  }
};
