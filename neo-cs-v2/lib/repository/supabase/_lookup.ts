// N+1 解消用の単純 select repo (申し送り l〜q)
// すべて read-only、フィルタ不要なため audit hook は走らせない。

import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { DEFAULT_ORG_ID } from "../types";
import { runAfterWrite } from "../_base";
import { getActorContext } from "./_actor";
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

type ContactRoleRow = {
  contact_id: string;
  scope: "overall" | ProductCode;
  level: "executive" | "approver" | "lead" | "member";
  cycle_no: number | null;
};

export const supabaseContactRepo: ContactRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("company_contacts")
      .select("id,organization_id,company_id,name,department,title,email,tel,is_primary")
      .eq("company_id", companyId);
    if (error) throw new Error(`company_contacts.listByCompany: ${error.message}`);
    const contacts = data ?? [];
    if (contacts.length === 0) return [];
    // 役割 (scope/level/cycle_no) を一括 join
    const ids = contacts.map((c: { id: string }) => c.id);
    const { data: rolesData, error: rolesErr } = await sb
      .from("company_contact_roles")
      .select("contact_id,scope,level,cycle_no")
      .in("contact_id", ids);
    if (rolesErr) {
      // table 未作成の環境では無視 (mock fallback と同等の挙動)
      process.stderr.write(
        JSON.stringify({
          at: new Date().toISOString(),
          kind: "company_contact_roles_unavailable",
          message: rolesErr.message
        }) + "\n"
      );
    }
    const rolesByContact = new Map<string, { scope: "overall" | ProductCode; level: "executive" | "approver" | "lead" | "member"; cycleNo?: number }[]>();
    for (const r of (rolesData ?? []) as ContactRoleRow[]) {
      const arr = rolesByContact.get(r.contact_id) ?? [];
      arr.push({
        scope: r.scope,
        level: r.level,
        cycleNo: r.cycle_no ?? undefined
      });
      rolesByContact.set(r.contact_id, arr);
    }
    return (contacts as ContactRow[]).map((r) => {
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
        products: [] as ProductCode[],
        roles: rolesByContact.get(r.id) ?? []
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
  },

  async create(input) {
    const sb = getServiceClient();
    const isCross = input.product === "cross";
    const { data, error } = await sb
      .from("meeting_logs")
      .insert({
        organization_id: input.organizationId ?? DEFAULT_ORG_ID,
        company_id: input.companyId,
        product_code: isCross ? null : input.product,
        is_cross: isCross,
        log_type: input.type,
        occurred_at: input.date,
        title: input.title,
        summary: input.summary || null,
        good: input.good ?? null,
        more: input.more ?? null,
        next_action: input.next ?? null,
        author_user_id: input.authorName || null,
        ai_generated: input.aiGenerated
      })
      .select()
      .single();
    if (error) throw new Error(`meeting_logs.create: ${error.message}`);
    const r = data as MeetingLogRow;
    return {
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
    };
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
  engagement_tier: "core" | "active" | "casual" | "at_risk" | null;
  engagement_tier_overridden_by: string | null;
  engagement_tier_overridden_at: string | null;
  engagement_note: string | null;
};

function toStakeholder(r: StakeholderRow): Stakeholder {
  return {
    id: r.id,
    organizationId: r.organization_id,
    companyId: r.company_id,
    name: r.name,
    role: r.role_title ?? "",
    department: r.department ?? undefined,
    type: r.stakeholder_type as Stakeholder["type"],
    products: [] as ProductCode[],
    activeFrom: r.active_from,
    activeTo: r.active_to ?? undefined,
    note: r.note ?? undefined,
    engagementTier: r.engagement_tier,
    engagementTierOverriddenBy: r.engagement_tier_overridden_by ?? undefined,
    engagementTierOverriddenAt: r.engagement_tier_overridden_at ?? undefined,
    engagementNote: r.engagement_note ?? undefined
  } satisfies Stakeholder;
}

export const supabaseStakeholderRepo: StakeholderRepo = {
  async listByCompany(companyId) {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("stakeholders")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(`stakeholders.listByCompany: ${error.message}`);
    return (data ?? []).map((r: StakeholderRow) => toStakeholder(r));
  },

  async list(filter) {
    const sb = getServiceClient();
    let q = sb.from("stakeholders").select("*");
    if (filter?.organizationId) q = q.eq("organization_id", filter.organizationId);
    const { data, error } = await q;
    if (error) throw new Error(`stakeholders.list: ${error.message}`);
    return (data ?? []).map((r: StakeholderRow) => toStakeholder(r));
  },

  async setEngagementTier(id, input) {
    const sb = getServiceClient();
    const ctx = getActorContext();
    const { data: before } = await sb
      .from("stakeholders")
      .select(
        "engagement_tier,engagement_tier_overridden_by,engagement_tier_overridden_at,engagement_note"
      )
      .eq("id", id)
      .maybeSingle();

    const patch = input.tier === null
      ? {
          engagement_tier: null,
          engagement_tier_overridden_by: null,
          engagement_tier_overridden_at: null,
          engagement_note: input.note ?? null
        }
      : {
          engagement_tier: input.tier,
          engagement_tier_overridden_by:
            input.actorUserId ?? ctx.actor.userId ?? null,
          engagement_tier_overridden_at: new Date().toISOString(),
          engagement_note: input.note ?? null
        };

    const { data, error } = await sb
      .from("stakeholders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(`stakeholders.setEngagementTier: ${error.message}`);

    await runAfterWrite({
      entityType: "stakeholders",
      entityId: id,
      before,
      after: patch,
      action: "update",
      ctx
    });

    return toStakeholder(data as StakeholderRow);
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
  },
  async update(id, patch) {
    const sb = getServiceClient();
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
    if (patch.assignee !== undefined) row.assignee_user_id = patch.assignee;
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.status === "done") row.completed_at = new Date().toISOString();
    const { data, error } = await sb
      .from("onboarding_tasks")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(`onboarding_tasks.update: ${error.message}`);
    const r = data as ContractOnboardingItem & {
      template_item_id?: string | null;
      phase_key?: string | null;
      assignee_user_id?: string | null;
      due_date?: string | null;
      completed_at?: string | null;
      contract_id: string;
    };
    return {
      id: r.id,
      organizationId: DEFAULT_ORG_ID,
      contractId: r.contract_id,
      // 詳細表示で必要な追加列は listByContractIds 側で組み立てる構造。
      // update 直後の戻りは最小限フィールドだけで済む (UI は revalidate で再取得)。
      categoryKey: "",
      itemKey: "",
      name: r.name,
      dueDate: r.due_date ?? "",
      assignee: r.assignee_user_id ?? "",
      status: r.status as ContractOnboardingItem["status"],
      required: true,
      completedAt: r.completed_at ?? undefined
    };
  },
  async createBatch(items) {
    if (items.length === 0) return [];
    const sb = getServiceClient();
    const rows = items.map((it) => ({
      id: it.id,
      organization_id: it.organizationId ?? DEFAULT_ORG_ID,
      contract_id: it.contractId,
      phase_key: it.categoryKey,
      name: it.name,
      due_date: it.dueDate || null,
      assignee_user_id: it.assignee || null,
      status: it.status,
      completed_at: it.completedAt ?? null
    }));
    const { error } = await sb.from("onboarding_tasks").insert(rows);
    if (error) throw new Error(`onboarding_tasks.createBatch: ${error.message}`);
    return items.map((it) => ({ ...it }));
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
