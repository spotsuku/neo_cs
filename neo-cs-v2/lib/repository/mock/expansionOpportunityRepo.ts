// エクスパンション機会 mock リポジトリ
// 起動時 seed として全 active 契約をスキャン → detectExpansionOpportunities

import { activeContracts } from "@/lib/mock/onboarding";
import { stakeholders as mockStakeholders } from "@/lib/mock/cycles";
import { surveyResponses } from "@/lib/mock/surveys";
import { productByCode } from "@/lib/master";
import { detectExpansionOpportunities } from "@/lib/domain/expansion/expansion";
import { mockHealthSnapshotRepo } from "./healthSnapshotRepo";
import { DEFAULT_ORG_ID } from "../types";
import type {
  ExpansionOpportunityFilter,
  ExpansionOpportunityRecord,
  ExpansionOpportunityRepo
} from "../types";

const TODAY = "2026-04-24";

// stakeholderHistory: 既存 mock の cycles.ts は単一スナップショットなので、
// type 履歴は持たない。ただし「ある stakeholder が現在 decision_maker でかつ
// activeFrom が古い」を「過去 champion → 昇格」の擬似シグナルに使う。
// (mock のため。実DBは stakeholder_history テーブルから取る前提)
type StakeholderHistoryEntry = {
  stakeholderId: string;
  type: "user" | "champion" | "decision_maker";
  recordedAt: string;
};

function deriveStakeholderHistory(companyId: string): StakeholderHistoryEntry[] {
  const list = mockStakeholders.filter((s) => s.companyId === companyId);
  return list.flatMap<StakeholderHistoryEntry>((s) => {
    if (s.companyId === "c-aeon" && s.id === "sh-aeon-1" && s.type === "decision_maker") {
      return [
        { stakeholderId: s.id, type: "champion", recordedAt: "2025-04-01" },
        { stakeholderId: s.id, type: "decision_maker", recordedAt: "2026-04-01" }
      ];
    }
    const t: StakeholderHistoryEntry["type"] =
      s.type === "user" ? "user" : s.type === "champion" ? "champion" : "decision_maker";
    return [{ stakeholderId: s.id, type: t, recordedAt: s.activeFrom }];
  });
}

function deriveSurveyTexts(companyId: string): string[] {
  const out: string[] = [];
  for (const r of surveyResponses) {
    if (r.companyId !== companyId) continue;
    for (const a of r.answers) {
      if (typeof a.value === "string" && a.value.length > 0) out.push(a.value);
    }
  }
  // mock だけでは拡張系のキーワードが少ないので、c-toto (Health green相当) と
  // c-saibugas に「他コースも気になる」「人数を増やしたい」シグナルを注入
  if (companyId === "c-toto") {
    out.push("リーダー育成と並行して、他コースも気になる。次年度はAIKENも検討したい。");
  }
  if (companyId === "c-saibugas") {
    out.push("受講者の人数を増やしたい。他部署からも参加させたい。");
  }
  return out;
}

async function seedOpportunities(): Promise<ExpansionOpportunityRecord[]> {
  const out: ExpansionOpportunityRecord[] = [];
  for (const c of activeContracts) {
    const snapshots = await mockHealthSnapshotRepo.listByContract(c.id);
    const product = productByCode[c.product];
    const detected = detectExpansionOpportunities({
      contractId: c.id,
      companyId: c.companyId,
      product: c.product,
      mrr: c.mrr,
      endDate: c.endDate,
      participantCount: c.participants,
      participantCap: product?.participantCap ?? undefined,
      stakeholderHistory: deriveStakeholderHistory(c.companyId),
      recentSurveyTexts: deriveSurveyTexts(c.companyId),
      snapshots: snapshots.map((s) => ({ asOf: s.asOf, score: s.score })),
      asOf: `${TODAY}T09:00:00Z`
    });
    for (const op of detected) {
      out.push({
        id: op.id,
        organizationId: DEFAULT_ORG_ID,
        contractId: op.contractId,
        companyId: op.companyId,
        product: op.product,
        kind: op.kind,
        rule: op.rule,
        score: op.score,
        reason: op.reason,
        evidence: op.evidence,
        suggestedAction: op.suggestedAction,
        estimatedUpsellJpy: op.estimatedUpsellJpy,
        detectedAt: op.detectedAt
      });
    }
  }
  return out;
}

import { getOrInitGlobalStore } from "./_global-store";
import { mockMutate } from "./_mockMutate";
const state = getOrInitGlobalStore<{
  store: ExpansionOpportunityRecord[];
  seeded: boolean;
}>("__expansionOppState", () => ({ store: [], seeded: false }));
async function ensureSeeded(): Promise<void> {
  if (state.seeded) return;
  const seeded = await seedOpportunities();
  state.store.length = 0;
  state.store.push(...seeded);
  state.seeded = true;
}
const store = state.store;

function applyFilter(
  list: ExpansionOpportunityRecord[],
  f?: ExpansionOpportunityFilter
): ExpansionOpportunityRecord[] {
  if (!f) return list;
  return list.filter((o) => {
    if (f.organizationId && o.organizationId !== f.organizationId) return false;
    if (f.contractId && o.contractId !== f.contractId) return false;
    if (f.companyId && o.companyId !== f.companyId) return false;
    if (f.kind && o.kind !== f.kind) return false;
    if (f.rule && o.rule !== f.rule) return false;
    if (f.openOnly && o.closedAt) return false;
    if (f.unNotifiedOnly && o.notifiedAt) return false;
    if (f.minScore !== undefined && o.score < f.minScore) return false;
    return true;
  });
}

function clone(o: ExpansionOpportunityRecord): ExpansionOpportunityRecord {
  return { ...o, evidence: { ...o.evidence } };
}

export const mockExpansionOpportunityRepo: ExpansionOpportunityRepo = {
  async list(filter) {
    await ensureSeeded();
    return applyFilter(store, filter)
      .sort((a, b) => b.score - a.score || b.detectedAt.localeCompare(a.detectedAt))
      .map(clone);
  },
  async listByContract(contractId, opts) {
    await ensureSeeded();
    return store
      .filter((o) => o.contractId === contractId)
      .filter((o) => (opts?.openOnly ? !o.closedAt : true))
      .sort((a, b) => b.score - a.score)
      .map(clone);
  },
  async upsert(input) {
    await ensureSeeded();
    const id = input.id ?? `exp-${input.contractId}-${input.rule}`;
    const idx = store.findIndex((o) => o.id === id);
    const merged: ExpansionOpportunityRecord = {
      ...input,
      id,
      evidence: { ...input.evidence }
    };
    let before: ExpansionOpportunityRecord | undefined;
    if (idx >= 0) {
      const prev = store[idx];
      before = clone(prev);
      merged.handedOffAt = prev.handedOffAt;
      merged.handedOffTo = prev.handedOffTo;
      merged.handedOffNote = prev.handedOffNote;
      merged.closedAt = prev.closedAt;
      merged.closedReason = prev.closedReason;
      merged.notifiedAt = prev.notifiedAt;
      store[idx] = merged;
    } else {
      store.push(merged);
    }
    await mockMutate({
      entityType: "expansion_opportunities",
      entityId: id,
      action: idx >= 0 ? "update" : "create",
      before,
      after: merged,
      organizationId: merged.organizationId
    });
    return clone(merged);
  },
  async handOff(id, opts) {
    await ensureSeeded();
    const idx = store.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      handedOffAt: opts.handedOffAt ?? new Date().toISOString(),
      handedOffTo: opts.handedOffTo,
      handedOffNote: opts.note
    };
    await mockMutate({
      entityType: "expansion_opportunities",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  },
  async close(id, opts) {
    await ensureSeeded();
    const idx = store.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      closedAt: opts.closedAt ?? new Date().toISOString(),
      closedReason: opts.reason
    };
    await mockMutate({
      entityType: "expansion_opportunities",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  },
  async markNotified(id, notifiedAt) {
    await ensureSeeded();
    const idx = store.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const before = clone(store[idx]);
    store[idx] = {
      ...store[idx],
      notifiedAt: notifiedAt ?? new Date().toISOString()
    };
    await mockMutate({
      entityType: "expansion_opportunities",
      entityId: id,
      action: "update",
      before,
      after: store[idx],
      organizationId: store[idx].organizationId
    });
  }
};
