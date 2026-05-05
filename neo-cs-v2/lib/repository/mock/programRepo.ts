// 事業内ToDo (program_*) mock リポジトリ
// マイグレーション: supabase/migrations/0020_program_tasks.sql
// 純関数群: lib/domain/program.ts

import { allContracts, activeContracts } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "../types";
import type {
  ProgramRepo,
  ProgramTerm,
  ProgramTaskTemplate,
  ProgramCompanyTask,
  ProgramTermCreateInput,
  ProgramTaskTemplateInput,
  ProgramCellPatch,
  ProgramTermStatus
} from "../types";
import { contractMatchesScope } from "@/lib/domain/program";
import { useGlobalStore } from "./_global-store";

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const NOW = "2026-04-24T09:00:00Z";

// ─────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────
const seedTerms: ProgramTerm[] = [
  {
    id: "pt-academia-leader-7",
    organizationId: DEFAULT_ORG_ID,
    productCode: "academia",
    courseKey: "leader",
    cycleNo: null,
    label: "アカデミア リーダー育成 (今期)",
    startedAt: "2026-04-01",
    closedAt: "2026-09-30",
    status: "active",
    createdBy: "u-furuno",
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "pt-aiken-basic-3",
    organizationId: DEFAULT_ORG_ID,
    productCode: "aiken",
    courseKey: "basic",
    cycleNo: null,
    label: "AI研 Basic (今期)",
    startedAt: "2026-05-01",
    closedAt: "2026-07-31",
    status: "active",
    createdBy: "u-furuno",
    createdAt: NOW,
    updatedAt: NOW
  }
];

const seedTemplates: ProgramTaskTemplate[] = [
  // Academia leader 7
  {
    id: "ptpl-al7-1",
    programTermId: "pt-academia-leader-7",
    orderNo: 1,
    label: "面談日程調整",
    category: "meeting_schedule",
    defaultDueOffsetDays: 7,
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "ptpl-al7-2",
    programTermId: "pt-academia-leader-7",
    orderNo: 2,
    label: "招待メール送付",
    category: "invite_send",
    defaultDueOffsetDays: 14,
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "ptpl-al7-3",
    programTermId: "pt-academia-leader-7",
    orderNo: 3,
    label: "面談実施",
    category: "meeting_hold",
    defaultDueOffsetDays: 30,
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "ptpl-al7-4",
    programTermId: "pt-academia-leader-7",
    orderNo: 4,
    label: "事後フォロー",
    category: "followup",
    defaultDueOffsetDays: 45,
    createdAt: NOW,
    updatedAt: NOW
  },
  // AI研 Basic 3
  {
    id: "ptpl-aib3-1",
    programTermId: "pt-aiken-basic-3",
    orderNo: 1,
    label: "事前アンケート送付",
    category: "material_send",
    defaultDueOffsetDays: 7,
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "ptpl-aib3-2",
    programTermId: "pt-aiken-basic-3",
    orderNo: 2,
    label: "招待送付",
    category: "invite_send",
    defaultDueOffsetDays: 14,
    createdAt: NOW,
    updatedAt: NOW
  },
  {
    id: "ptpl-aib3-3",
    programTermId: "pt-aiken-basic-3",
    orderNo: 3,
    label: "研修実施",
    category: "meeting_hold",
    defaultDueOffsetDays: 30,
    createdAt: NOW,
    updatedAt: NOW
  }
];

const termsStore = useGlobalStore<ProgramTerm[]>("__programTermsStore", () =>
  seedTerms.map((t) => ({ ...t }))
);
const templatesStore = useGlobalStore<ProgramTaskTemplate[]>(
  "__programTemplatesStore",
  () => seedTemplates.map((t) => ({ ...t }))
);
const cellsStore = useGlobalStore<ProgramCompanyTask[]>(
  "__programCellsStore",
  () => []
);

// デモ用: 一部テンプレに defaultDueDate を入れて列ヘッダ初期値を見せる
// seedCellsFor が tp.defaultDueDate を参照するので seedCellsFor より先に設定
{
  const tplDueDates: Record<string, string> = {
    "ptpl-al7-1": "2026-05-15",
    "ptpl-al7-2": "2026-05-29",
    "ptpl-al7-3": "2026-06-15",
    "ptpl-al7-4": "2026-07-01"
  };
  for (const [tplId, due] of Object.entries(tplDueDates)) {
    const i = templatesStore.findIndex((t) => t.id === tplId);
    if (i >= 0) templatesStore[i].defaultDueDate = due;
  }
  // デモ用: 列の責任者初期値
  const tplResponsibles: Record<string, string> = {
    "ptpl-al7-1": "u-furuno",
    "ptpl-al7-2": "u-furuno"
  };
  for (const [tplId, uid] of Object.entries(tplResponsibles)) {
    const i = templatesStore.findIndex((t) => t.id === tplId);
    if (i >= 0) templatesStore[i].defaultAssigneeTo = uid;
  }
}

// 初期セルを各 term × 対象企業 × テンプレで生成
function seedCellsFor(termId: string) {
  const term = termsStore.find((t) => t.id === termId);
  if (!term) return;
  const templates = templatesStore.filter((tp) => tp.programTermId === termId);
  // 契約中 (status: active / onboarding 等で活きているもの) のみを対象に。
  // mock の activeContracts は cycleStatus="active" のもの。
  const targetContracts = activeContracts.filter((c) =>
    contractMatchesScope(
      { product: c.product, courseKey: c.courseKey, cycleNumber: c.cycleNumber },
      { productCode: term.productCode, courseKey: term.courseKey, cycleNo: term.cycleNo }
    )
  );
  // mock の seed 用フォールバック: activeContracts に該当が0件でも、allContracts
  // から最新サイクル分は拾うようにしておく (デモ用途)
  if (targetContracts.length === 0) {
    targetContracts.push(
      ...allContracts.filter((c) =>
        contractMatchesScope(
          { product: c.product, courseKey: c.courseKey, cycleNumber: c.cycleNumber },
          { productCode: term.productCode, courseKey: term.courseKey, cycleNo: term.cycleNo }
        )
      )
    );
  }
  for (const c of targetContracts) {
    for (const tp of templates) {
      const exists = cellsStore.some(
        (x) =>
          x.programTermId === termId &&
          x.templateId === tp.id &&
          x.companyId === c.companyId
      );
      if (exists) continue;
      cellsStore.push({
        // 決定論的 ID: 再起動しても同じ ID になり、ブラウザに残った参照が壊れない
        // (cell は (termId, templateId, companyId) の3つ組で一意)
        id: `ptc-${termId}-${tp.id}-${c.companyId}`,
        organizationId: DEFAULT_ORG_ID,
        programTermId: termId,
        templateId: tp.id,
        companyId: c.companyId,
        contractId: c.id,
        status: "pending",
        dueDate: tp.defaultDueDate,
        createdAt: NOW,
        updatedAt: NOW
      });
    }
  }
}

seedTerms.forEach((t) => seedCellsFor(t.id));

// 動作確認用: 一部セルを進行中/完了/期限切れに
const idx1 = cellsStore.findIndex(
  (c) => c.templateId === "ptpl-al7-1" && c.companyId === "c-aeon"
);
if (idx1 >= 0) {
  cellsStore[idx1].status = "done";
  cellsStore[idx1].completedAt = NOW;
}
const idx2 = cellsStore.findIndex(
  (c) => c.templateId === "ptpl-al7-2" && c.companyId === "c-aeon"
);
if (idx2 >= 0) {
  cellsStore[idx2].status = "in_progress";
  cellsStore[idx2].dueDate = "2026-04-22"; // overdue
}
const idx3 = cellsStore.findIndex(
  (c) => c.templateId === "ptpl-al7-1" && c.companyId === "c-jrq"
);
if (idx3 >= 0) {
  cellsStore[idx3].status = "in_progress";
  cellsStore[idx3].dueDate = "2026-04-30";
}

// デモ用: TOTO の al7-1 だけ列既定 (5/15) ではなく個別 6/5 に上書き → 期限切れではない個別期日
const idx4 = cellsStore.findIndex(
  (c) => c.templateId === "ptpl-al7-1" && c.companyId === "c-toto"
);
if (idx4 >= 0) {
  cellsStore[idx4].dueDate = "2026-06-05";
}

// デモ用: 担当者・メモを一部セルに設定
const demoUserAssignments: Array<{ template: string; company: string; user: string }> = [
  { template: "ptpl-al7-1", company: "c-aeon", user: "u-furuno" },
  { template: "ptpl-al7-1", company: "c-jrq", user: "u-miki" },
  { template: "ptpl-al7-2", company: "c-aeon", user: "u-furuno" },
  { template: "ptpl-al7-3", company: "c-jrq", user: "u-miki" },
  { template: "ptpl-aib3-1", company: "c-levias", user: "u-matsuda" }
];
for (const a of demoUserAssignments) {
  const i = cellsStore.findIndex(
    (c) => c.templateId === a.template && c.companyId === a.company
  );
  if (i >= 0) cellsStore[i].assignedTo = a.user;
}

const demoNotes: Array<{ template: string; company: string; note: string }> = [
  {
    template: "ptpl-al7-1",
    company: "c-aeon",
    note: "山田部長と5/8(金) 16:00で確定。会議室予約済み。"
  },
  {
    template: "ptpl-al7-2",
    company: "c-aeon",
    note: "招待メールが先方フィルタに掛かった可能性あり。再送検討。"
  }
];
for (const n of demoNotes) {
  const i = cellsStore.findIndex(
    (c) => c.templateId === n.template && c.companyId === n.company
  );
  if (i >= 0) cellsStore[i].note = n.note;
}


// ─────────────────────────────────────────────
// Repo 実装
// ─────────────────────────────────────────────
function clone<T>(x: T): T {
  return { ...(x as object) } as T;
}

export const mockProgramRepo: ProgramRepo = {
  async listTerms(filter) {
    let list = termsStore.slice();
    if (filter?.status) {
      const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
      list = list.filter((t) => arr.includes(t.status));
    }
    return list
      .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
      .map(clone);
  },
  async getTerm(id) {
    const t = termsStore.find((x) => x.id === id);
    return t ? clone(t) : null;
  },
  async createTerm(input) {
    const now = new Date().toISOString();
    const term: ProgramTerm = {
      id: genId("pt"),
      organizationId: DEFAULT_ORG_ID,
      productCode: input.productCode,
      courseKey: input.courseKey ?? null,
      cycleNo: input.cycleNo ?? null,
      label: input.label,
      startedAt: input.startedAt,
      closedAt: input.closedAt,
      status: input.status ?? "active",
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now
    };
    termsStore.push(term);
    return clone(term);
  },
  async closeTerm(id) {
    const i = termsStore.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`ProgramTerm not found: ${id}`);
    termsStore[i] = {
      ...termsStore[i],
      status: "closed",
      updatedAt: new Date().toISOString()
    };
    return clone(termsStore[i]);
  },

  async deleteTerm(id) {
    const i = termsStore.findIndex((x) => x.id === id);
    if (i < 0) return; // すでに無いなら no-op
    termsStore.splice(i, 1);
    // 関連テンプレ・セルも削除 (本番 supabase は CASCADE 制約で自動)
    for (let j = templatesStore.length - 1; j >= 0; j--) {
      if (templatesStore[j].programTermId === id) templatesStore.splice(j, 1);
    }
    for (let j = cellsStore.length - 1; j >= 0; j--) {
      if (cellsStore[j].programTermId === id) cellsStore.splice(j, 1);
    }
  },

  async listTemplates(programTermId) {
    return templatesStore
      .filter((t) => t.programTermId === programTermId)
      .sort((a, b) => a.orderNo - b.orderNo)
      .map(clone);
  },
  async upsertTemplate(input) {
    const now = new Date().toISOString();
    if (input.id) {
      const i = templatesStore.findIndex((x) => x.id === input.id);
      if (i < 0) throw new Error(`Template not found: ${input.id}`);
      templatesStore[i] = {
        ...templatesStore[i],
        ...input,
        id: input.id,
        updatedAt: now
      } as ProgramTaskTemplate;
      return clone(templatesStore[i]);
    }
    const created: ProgramTaskTemplate = {
      id: genId("ptpl"),
      programTermId: input.programTermId,
      orderNo: input.orderNo,
      label: input.label,
      description: input.description,
      category: input.category,
      defaultDueOffsetDays: input.defaultDueOffsetDays,
      createdAt: now,
      updatedAt: now
    };
    templatesStore.push(created);
    return clone(created);
  },
  async setTemplateDueDate(templateId, dueDate) {
    const i = templatesStore.findIndex((x) => x.id === templateId);
    if (i < 0) throw new Error(`Template not found: ${templateId}`);
    const now = new Date().toISOString();
    const previousDefault = templatesStore[i].defaultDueDate;
    templatesStore[i] = {
      ...templatesStore[i],
      defaultDueDate: dueDate ?? undefined,
      updatedAt: now
    };
    // open セル (pending / in_progress) のうち、列既定値を継承していたものだけ更新。
    // セルの dueDate が「未設定」or「直前の列既定値と一致」なら継承中とみなす。
    // 個別に別の日付が設定されているセルは上書きしない (個別値を尊重)。
    for (let j = 0; j < cellsStore.length; j++) {
      const c = cellsStore[j];
      if (c.templateId !== templateId) continue;
      if (c.status !== "pending" && c.status !== "in_progress") continue;
      const inheriting = c.dueDate == null || c.dueDate === previousDefault;
      if (!inheriting) continue;
      cellsStore[j] = { ...c, dueDate: dueDate ?? undefined, updatedAt: now };
    }
    return clone(templatesStore[i]);
  },
  async setTemplateAssignee(templateId, userId, opts) {
    const i = templatesStore.findIndex((x) => x.id === templateId);
    if (i < 0) throw new Error(`Template not found: ${templateId}`);
    const now = new Date().toISOString();
    templatesStore[i] = {
      ...templatesStore[i],
      defaultAssigneeTo: userId ?? undefined,
      updatedAt: now
    };
    if (opts?.propagate) {
      for (let j = 0; j < cellsStore.length; j++) {
        const c = cellsStore[j];
        if (c.templateId !== templateId) continue;
        if (c.status !== "pending" && c.status !== "in_progress") continue;
        cellsStore[j] = { ...c, assignedTo: userId ?? undefined, updatedAt: now };
      }
    }
    return clone(templatesStore[i]);
  },
  async updateTemplateMeta(templateId, patch) {
    const i = templatesStore.findIndex((x) => x.id === templateId);
    if (i < 0) throw new Error(`Template not found: ${templateId}`);
    const now = new Date().toISOString();
    templatesStore[i] = {
      ...templatesStore[i],
      ...patch,
      updatedAt: now
    } as ProgramTaskTemplate;
    return clone(templatesStore[i]);
  },
  async deleteTemplate(id) {
    const i = templatesStore.findIndex((x) => x.id === id);
    if (i >= 0) templatesStore.splice(i, 1);
    // 関連セルもまとめて削除
    for (let j = cellsStore.length - 1; j >= 0; j--) {
      if (cellsStore[j].templateId === id) cellsStore.splice(j, 1);
    }
  },

  async syncCompanies(programTermId) {
    const before = cellsStore.length;
    seedCellsFor(programTermId);
    return { created: cellsStore.length - before };
  },

  async copyTemplates(fromTermId, toTermId) {
    const now = new Date().toISOString();
    const src = templatesStore
      .filter((t) => t.programTermId === fromTermId)
      .sort((a, b) => a.orderNo - b.orderNo);
    let copied = 0;
    for (const t of src) {
      templatesStore.push({
        id: genId("ptpl"),
        programTermId: toTermId,
        orderNo: t.orderNo,
        label: t.label,
        description: t.description,
        category: t.category,
        defaultDueOffsetDays: t.defaultDueOffsetDays,
        // 期固有の値はコピーしない
        defaultDueDate: undefined,
        defaultAssigneeTo: undefined,
        createdAt: now,
        updatedAt: now
      });
      copied++;
    }
    return { copied };
  },

  async listCells(programTermId) {
    return cellsStore
      .filter((c) => c.programTermId === programTermId)
      .map(clone);
  },
  async updateCell(id, patch) {
    const i = cellsStore.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`ProgramCompanyTask not found: ${id}`);
    const now = new Date().toISOString();
    const next = { ...cellsStore[i], ...patch, updatedAt: now } as ProgramCompanyTask;
    if (patch.status === "done" && !next.completedAt) {
      next.completedAt = now;
    }
    cellsStore[i] = next;
    return clone(next);
  }
};

// 用途別 status のフィルタ便利関数 (使われない場合は削除可)
export function isActiveTermStatus(s: ProgramTermStatus): boolean {
  return s === "active" || s === "draft";
}
