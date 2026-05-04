// N+1 解消用の単純 select repo (申し送り l〜q)
// すべて read-only、フィルタ不要なため audit hook は走らせない。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "../types";
import type {
  AccountJourney,
  AccountJourneyRepo,
  Contact,
  ContactRepo,
  ContractOnboardingItem,
  MeetingLog,
  MeetingLogListOpts,
  MeetingLogRepo,
  OnboardingItemRepo,
  ProductCode,
  Stakeholder,
  StakeholderRepo,
  SuccessPlan,
  SuccessPlanRepo
} from "../types";

// ─────────────────────────────────────────────
// contacts
// ─────────────────────────────────────────────
type ContactRow = {
  id: string;
  organization_id: string;
  company_id: string;
  name: string;
  department: string | null;
  title: string | null;
  email: string | null;
  tel: string | null;
  is_primary: boolean;
};

export const supabaseContactRepo: ContactRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_contacts")
      .select("id,organization_id,company_id,name,department,title,email,tel,is_primary")
      .eq("company_id", companyId);
    if (error) throw new Error(`company_contacts.listByCompany: ${error.message}`);
    return (data ?? []).map((r: ContactRow) => {
      // products は company_contact_products 経由 (個別 fetch)。
      // 本ヘルパは N+1 解消が目的なので products は呼び出し側で必要なら別途取得する。
      return {
        id: r.id,
        organizationId: r.organization_id,
        companyId: r.company_id,
        name: r.name,
        department: r.department ?? "",
        title: r.title ?? "",
        email: r.email ?? "",
        tel: r.tel ?? undefined,
        isPrimary: r.is_primary,
        products: [] as ProductCode[]
      } satisfies Contact;
    });
  },
  async create(input) {
    const sb = getServiceClient();
    const id = `p-${Math.random().toString(36).slice(2, 10)}`;
    const row = {
      id,
      organization_id: input.organizationId ?? DEFAULT_ORG_ID,
      company_id: input.companyId,
      name: input.name,
      department: input.department || null,
      title: input.title || null,
      email: input.email || null,
      tel: input.tel ?? null,
      is_primary: input.isPrimary
    };
    const { data, error } = await sb
      .from("company_contacts")
      .insert(row)
      .select("id,organization_id,company_id,name,department,title,email,tel,is_primary")
      .single();
    if (error) throw new Error(`company_contacts.create: ${error.message}`);
    const r = data as ContactRow;
    return {
      id: r.id,
      organizationId: r.organization_id,
      companyId: r.company_id,
      name: r.name,
      department: r.department ?? "",
      title: r.title ?? "",
      email: r.email ?? "",
      tel: r.tel ?? undefined,
      isPrimary: r.is_primary,
      products: input.products ?? []
    } satisfies Contact;
  }
};

// ─────────────────────────────────────────────
// meeting_logs
// ─────────────────────────────────────────────
type MeetingLogRow = {
  id: string;
  organization_id: string;
  company_id: string;
  product_code: ProductCode | null;
  is_cross: boolean;
  log_type: "mtg" | "mail" | "call";
  occurred_at: string;
  title: string;
  summary: string | null;
  good: string | null;
  more: string | null;
  next_action: string | null;
  author_user_id: string | null;
  ai_generated: boolean;
};

export const supabaseMeetingLogRepo: MeetingLogRepo = {
  async listByCompany(companyId, opts?: MeetingLogListOpts) {
    const sb = getServiceClient();
    let q = sb
      .from("meeting_logs")
      .select("*")
      .eq("company_id", companyId);

    // sort: "<field> [asc|desc]" を解釈、サポート列のみ通す
    if (opts?.sort) {
      const m = opts.sort.match(/^(\w+)\s*(asc|desc)?$/i);
      if (m) {
        const [, field, dir] = m;
        const allowed: Record<string, string> = {
          date: "occurred_at",
          occurredAt: "occurred_at",
          createdAt: "occurred_at"
        };
        const col = allowed[field] ?? field;
        q = q.order(col, { ascending: (dir ?? "asc").toLowerCase() !== "desc" });
      }
    }
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`meeting_logs.listByCompany: ${error.message}`);
    return (data ?? []).map((r: MeetingLogRow) => ({
      id: r.id,
      organizationId: r.organization_id,
      companyId: r.company_id,
      date: r.occurred_at.slice(0, 10),
      product: (r.is_cross ? "cross" : r.product_code) as MeetingLog["product"],
      type: r.log_type,
      title: r.title,
      summary: r.summary ?? "",
      good: r.good ?? undefined,
      more: r.more ?? undefined,
      next: r.next_action ?? undefined,
      authorName: r.author_user_id ?? "",
      aiGenerated: r.ai_generated
    }));
  }
};

// ─────────────────────────────────────────────
// stakeholders
// ─────────────────────────────────────────────
type StakeholderRow = {
  id: string;
  organization_id: string;
  company_id: string;
  name: string;
  role_title: string | null;
  department: string | null;
  stakeholder_type: "decision_maker" | "champion" | "user" | "at_risk";
  active_from: string;
  active_to: string | null;
  note: string | null;
};

export const supabaseStakeholderRepo: StakeholderRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("stakeholders")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`stakeholders.listByCompany: ${error.message}`);
    return (data ?? []).map((r: StakeholderRow) => ({
      id: r.id,
      organizationId: r.organization_id,
      companyId: r.company_id,
      name: r.name,
      role: r.role_title ?? "",
      department: r.department ?? undefined,
      // type / engagement は mock 型に揃える
      type: r.stakeholder_type as Stakeholder["type"],
      products: [] as ProductCode[],
      activeFrom: r.active_from,
      activeTo: r.active_to ?? undefined,
      note: r.note ?? undefined
    } satisfies Stakeholder));
  }
};

// ─────────────────────────────────────────────
// account_journeys
// ─────────────────────────────────────────────
type JourneyRow = {
  organization_id: string;
  company_id: string;
  product_code: ProductCode;
  current_stage: AccountJourney["currentStage"];
  stage_entered_at: string;
};

export const supabaseAccountJourneyRepo: AccountJourneyRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("account_journeys")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`account_journeys.listByCompany: ${error.message}`);
    // history は account_journey_events を別 fetch して reduce する余地があるが、
    // 現状画面 (companies/[id]) は currentStage のみ参照する想定。
    return (data ?? []).map((r: JourneyRow) => ({
      companyId: r.company_id,
      product: r.product_code,
      currentStage: r.current_stage,
      stageEnteredAt: r.stage_entered_at,
      history: []
    } satisfies AccountJourney));
  }
};

// ─────────────────────────────────────────────
// onboarding items (instance)
// ─────────────────────────────────────────────
type OnboardingTaskRow = {
  id: string;
  organization_id: string;
  contract_id: string;
  phase_key: string | null;
  name: string;
  due_date: string | null;
  status: "todo" | "doing" | "done" | "overdue";
  assignee_user_id: string | null;
  completed_at: string | null;
};

export const supabaseOnboardingItemRepo: OnboardingItemRepo = {
  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("onboarding_tasks")
      .select("*")
      .in("contract_id", contractIds);
    if (error) throw new Error(`onboarding_tasks.listByContractIds: ${error.message}`);
    // Contract 上の onboarding は ContractOnboardingItem 形式に整形
    return (data ?? []).map((r: OnboardingTaskRow) => ({
      id: r.id,
      organizationId: r.organization_id,
      contractId: r.contract_id,
      categoryKey: r.phase_key ?? "",
      itemKey: r.id,
      name: r.name,
      dueDate: r.due_date ?? "",
      assignee: r.assignee_user_id ?? "",
      status: r.status,
      required: true,
      completedAt: r.completed_at ?? undefined
    } satisfies ContractOnboardingItem));
  }
};

// ─────────────────────────────────────────────
// success_plans (+ goals)
// ─────────────────────────────────────────────
type SuccessPlanRow = {
  contract_id: string;
  organization_id: string;
  overall_achievement: string | null;
  updated_at: string;
};

type SuccessPlanGoalRow = {
  id: string;
  contract_id: string;
  goal_key: string;
  title: string;
  target_metric: string | null;
  achievement: string | null;
  note: string | null;
  display_order: number;
};

export const supabaseSuccessPlanRepo: SuccessPlanRepo = {
  async listByContractIds(contractIds) {
    if (contractIds.length === 0) return [];
    const sb = getServiceClient();
    const [planRes, goalRes] = await Promise.all([
      sb.from("success_plans").select("*").in("contract_id", contractIds),
      sb
        .from("success_plan_goals")
        .select("*")
        .in("contract_id", contractIds)
        .order("display_order", { ascending: true })
    ]);
    if (planRes.error) throw new Error(`success_plans.list: ${planRes.error.message}`);
    if (goalRes.error)
      throw new Error(`success_plan_goals.list: ${goalRes.error.message}`);

    const goalsBy = new Map<string, SuccessPlanGoalRow[]>();
    for (const g of (goalRes.data ?? []) as SuccessPlanGoalRow[]) {
      const arr = goalsBy.get(g.contract_id) ?? [];
      arr.push(g);
      goalsBy.set(g.contract_id, arr);
    }

    return ((planRes.data ?? []) as SuccessPlanRow[]).map((p) => ({
      contractId: p.contract_id,
      overallAchievement: p.overall_achievement != null ? Number(p.overall_achievement) : 0,
      updatedAt: p.updated_at,
      goals: (goalsBy.get(p.contract_id) ?? []).map((g) => ({
        key: g.goal_key,
        title: g.title,
        targetMetric: g.target_metric ?? undefined,
        achievement: g.achievement != null ? Number(g.achievement) : 0,
        note: g.note ?? undefined
      }))
    } satisfies SuccessPlan));
  }
};
