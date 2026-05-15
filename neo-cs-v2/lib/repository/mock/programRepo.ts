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
import { contractMatchesScope } from "@/lib/domain/program/program";
import { getOrInitGlobalStore } from "./_global-store";

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const NOW = "2026-04-24T09:00:00Z";

// ─────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────
// データモデル:
//  - 1つの (期 × コーススコープ) に対して term は 1 つ
//  - courseKey=null は「全コース共通」、特定コース時は「コース別」
//  - 評議会 term は アカデミア契約も対象に取り込む (programRepo.syncCompanies 参照)
//
// 各事業の最新 active 期に対して、可能なら
//   - 共通 term (courseKey=null)
//   - 各コースの course-specific term
// を用意する。複数コースのない事業は 1 term のみ。

function term(
  id: string,
  productCode: string,
  courseKey: string | null,
  cycleNo: number,
  label: string,
  status: ProgramTermStatus,
  startedAt: string,
  closedAt: string
): ProgramTerm {
  return {
    id,
    organizationId: DEFAULT_ORG_ID,
    productCode,
    courseKey,
    cycleNo,
    label,
    startedAt,
    closedAt,
    status,
    createdBy: "u-furuno",
    createdAt: NOW,
    updatedAt: NOW
  };
}

const seedTerms: ProgramTerm[] = [
  // アカデミア 第3期 (active)
  term("pt-aca-3-common", "academia", null, 3, "アカデミア 共通 第3期", "active", "2026-04-01", "2026-09-30"),
  term("pt-aca-3-leader", "academia", "leader", 3, "アカデミア リーダー育成 第3期", "active", "2026-04-01", "2026-09-30"),
  term("pt-aca-3-pjt", "academia", "pjt", 3, "アカデミア PJT共創 第3期", "active", "2026-04-01", "2026-09-30"),
  // アカデミア 第2期 (closed) — 履歴
  term("pt-aca-2-common", "academia", null, 2, "アカデミア 共通 第2期", "closed", "2025-10-01", "2026-03-31"),
  term("pt-aca-2-leader", "academia", "leader", 2, "アカデミア リーダー育成 第2期", "closed", "2025-10-01", "2026-03-31"),

  // AI研 第4期 (active)
  term("pt-aiken-4-common", "aiken", null, 4, "AI研 共通 第4期", "active", "2026-04-01", "2026-07-31"),
  term("pt-aiken-4-basic", "aiken", "basic", 4, "AI研 Basic 第4期", "active", "2026-04-01", "2026-07-31"),
  term("pt-aiken-4-advance", "aiken", "advance", 4, "AI研 Advance 第4期", "active", "2026-04-01", "2026-07-31"),

  // 評議会 第3期 (active) — アカデミア契約も対象
  term("pt-hyo-3", "hyogikai", null, 3, "評議会 第3期", "active", "2026-04-01", "2027-03-31"),

  // コミュマネ 第1期 (active)
  term("pt-commu-1", "commu", null, 1, "コミュマネ 第1期", "active", "2026-04-01", "2026-06-30")
];

// テンプレ列を簡潔に書くためのヘルパ
function tpl(
  id: string,
  programTermId: string,
  orderNo: number,
  label: string,
  category: ProgramTaskTemplate["category"],
  defaultDueOffsetDays?: number
): ProgramTaskTemplate {
  return {
    id,
    programTermId,
    orderNo,
    label,
    category,
    defaultDueOffsetDays,
    createdAt: NOW,
    updatedAt: NOW
  };
}

const seedTemplates: ProgramTaskTemplate[] = [
  // ── アカデミア 共通 第3期 (どのコースでも実施) ──
  tpl("ptpl-aca3c-1", "pt-aca-3-common", 1, "NDA締結確認", "document_check", 7),
  tpl("ptpl-aca3c-2", "pt-aca-3-common", 2, "参加者リスト最終化", "material_send", 14),
  tpl("ptpl-aca3c-3", "pt-aca-3-common", 3, "キックオフ実施", "meeting_hold", 21),
  tpl("ptpl-aca3c-4", "pt-aca-3-common", 4, "中間アンケート回収", "followup", 90),

  // ── アカデミア リーダー育成 第3期 (コース固有) ──
  tpl("ptpl-aca3l-1", "pt-aca-3-leader", 1, "個別面談日程調整", "meeting_schedule", 14),
  tpl("ptpl-aca3l-2", "pt-aca-3-leader", 2, "リーダーシップ診断送付", "material_send", 30),
  tpl("ptpl-aca3l-3", "pt-aca-3-leader", 3, "個別面談実施", "meeting_hold", 45),
  tpl("ptpl-aca3l-4", "pt-aca-3-leader", 4, "最終発表会", "meeting_hold", 150),

  // ── アカデミア PJT共創 第3期 (コース固有) ──
  tpl("ptpl-aca3p-1", "pt-aca-3-pjt", 1, "PJTテーマ設定", "material_send", 14),
  tpl("ptpl-aca3p-2", "pt-aca-3-pjt", 2, "メンター割当", "meeting_schedule", 21),
  tpl("ptpl-aca3p-3", "pt-aca-3-pjt", 3, "中間レビュー", "meeting_hold", 90),
  tpl("ptpl-aca3p-4", "pt-aca-3-pjt", 4, "最終発表会", "meeting_hold", 150),

  // ── アカデミア 共通 第2期 (closed) ──
  tpl("ptpl-aca2c-1", "pt-aca-2-common", 1, "NDA締結確認", "document_check"),
  tpl("ptpl-aca2c-2", "pt-aca-2-common", 2, "参加者リスト最終化", "material_send"),
  tpl("ptpl-aca2c-3", "pt-aca-2-common", 3, "キックオフ実施", "meeting_hold"),

  // ── アカデミア リーダー育成 第2期 (closed) ──
  tpl("ptpl-aca2l-1", "pt-aca-2-leader", 1, "個別面談実施", "meeting_hold"),
  tpl("ptpl-aca2l-2", "pt-aca-2-leader", 2, "最終発表会", "meeting_hold"),

  // ── AI研 共通 第4期 ──
  tpl("ptpl-ai4c-1", "pt-aiken-4-common", 1, "事前アンケート送付", "material_send", 7),
  tpl("ptpl-ai4c-2", "pt-aiken-4-common", 2, "招待送付", "invite_send", 14),
  tpl("ptpl-ai4c-3", "pt-aiken-4-common", 3, "事後アンケート", "followup", 60),

  // ── AI研 Basic 第4期 ──
  tpl("ptpl-ai4b-1", "pt-aiken-4-basic", 1, "Basic研修実施", "meeting_hold", 30),
  tpl("ptpl-ai4b-2", "pt-aiken-4-basic", 2, "演習レビュー", "followup", 45),

  // ── AI研 Advance 第4期 ──
  tpl("ptpl-ai4a-1", "pt-aiken-4-advance", 1, "開発キックオフ", "meeting_hold", 14),
  tpl("ptpl-ai4a-2", "pt-aiken-4-advance", 2, "技術メンター割当", "meeting_schedule", 21),
  tpl("ptpl-ai4a-3", "pt-aiken-4-advance", 3, "デプロイ確認", "followup", 60),

  // ── 評議会 第3期 ──
  tpl("ptpl-hyo3-1", "pt-hyo-3", 1, "年間スケジュール案内", "material_send", 7),
  tpl("ptpl-hyo3-2", "pt-hyo-3", 2, "5月定例会 招待送付", "invite_send", 21),
  tpl("ptpl-hyo3-3", "pt-hyo-3", 3, "5月定例会 実施", "meeting_hold", 30),

  // ── コミュマネ 第1期 ──
  tpl("ptpl-commu1-1", "pt-commu-1", 1, "コミュニティ立ち上げ", "material_send", 7),
  tpl("ptpl-commu1-2", "pt-commu-1", 2, "初回オンボ", "meeting_hold", 14),
  tpl("ptpl-commu1-3", "pt-commu-1", 3, "1ヶ月レビュー", "followup", 45)
];

const termsStore = getOrInitGlobalStore<ProgramTerm[]>("__programTermsStore", () =>
  seedTerms.map((t) => ({ ...t }))
);
const templatesStore = getOrInitGlobalStore<ProgramTaskTemplate[]>(
  "__programTemplatesStore",
  () => seedTemplates.map((t) => ({ ...t }))
);
const cellsStore = getOrInitGlobalStore<ProgramCompanyTask[]>(
  "__programCellsStore",
  () => []
);

// デモ用: 一部テンプレに defaultDueDate / 責任者の初期値を入れて
// 列ヘッダの見栄えを作る (seedCellsFor が defaultDueDate を参照するので前に実行)
{
  const tplDueDates: Record<string, string> = {
    // アカデミア 共通 第3期
    "ptpl-aca3c-1": "2026-04-15",
    "ptpl-aca3c-2": "2026-04-22",
    "ptpl-aca3c-3": "2026-05-12",
    // アカデミア リーダー育成 第3期
    "ptpl-aca3l-1": "2026-05-01",
    "ptpl-aca3l-3": "2026-06-01",
    // AI研 共通 第4期
    "ptpl-ai4c-1": "2026-04-15",
    "ptpl-ai4c-2": "2026-04-22"
  };
  for (const [tplId, due] of Object.entries(tplDueDates)) {
    const i = templatesStore.findIndex((t) => t.id === tplId);
    if (i >= 0) templatesStore[i].defaultDueDate = due;
  }
  const tplResponsibles: Record<string, string> = {
    "ptpl-aca3c-1": "u-furuno",
    "ptpl-aca3c-2": "u-furuno",
    "ptpl-aca3l-1": "u-furuno",
    "ptpl-ai4c-1": "u-furuno"
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
  // 評議会 term は アカデミア契約も対象に含める (運用方針: ToDo は両者共通)
  // course/cycle のスコープは各事業内でのみ評価し、cross-product 取り込みは無条件
  const matchHyogikaiAcademia = (c: { product: string }) =>
    term.productCode === "hyogikai" && c.product === "academia";

  const matchScope = (c: {
    product: string;
    courseKey?: string | null;
    cycleNumber?: number | null;
  }) =>
    contractMatchesScope(
      { product: c.product, courseKey: c.courseKey, cycleNumber: c.cycleNumber },
      { productCode: term.productCode, courseKey: term.courseKey, cycleNo: term.cycleNo }
    ) || matchHyogikaiAcademia(c);

  const targetContracts = activeContracts.filter(matchScope);
  // mock の seed 用フォールバック: activeContracts に該当が0件でも、allContracts
  // から最新サイクル分は拾うようにしておく (デモ用途)
  if (targetContracts.length === 0) {
    targetContracts.push(...allContracts.filter(matchScope));
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

  async updateTerm(id, patch) {
    const i = termsStore.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`ProgramTerm not found: ${id}`);
    const next = {
      ...termsStore[i],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    termsStore[i] = next;
    return clone(next);
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
