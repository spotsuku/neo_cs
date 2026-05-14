"use server";

// 企業登録ウィザードの一括保存 Server Action
//
// クライアント側のウィザードから集約した payload を受け取り、
// companies → company_contacts → contracts → assignments の順で作成する。
// REPO_DRIVER に従って mock / supabase 双方で動作する。

import { getRepo } from "@/lib/repository/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type {
  AssignmentRole,
  ContractStatus,
  ProductCode
} from "@/lib/repository/types";

export type WizardContractInput = {
  product: ProductCode;
  courseKey?: string;
  planName?: string;
  startDate: string;
  endDate?: string;
  annualRevenueJpy?: number;
  participants?: number;
};

export type WizardAssignmentInput = {
  userId: string;
  role: AssignmentRole;
};

export type WizardSavePayload = {
  organizationId?: string;
  company: {
    name: string;
    kana?: string;
    industry?: string;
    employeeSize?: string;
    address?: string;
    websiteUrl?: string;
    foundedYear?: string;
    corporateNumber?: string;
    memo?: string;
    /**
     * 0019_is_demo_flag.sql: 本番運用前のダミーデータかどうか。
     * 本番開始前のフェーズでは true 既定でフォームに表示する。
     * 本番開始後はウィザード側のデフォルトを false に切り替える。
     */
    isDemo?: boolean;
  };
  contact?: {
    name: string;
    department?: string;
    title?: string;
    email?: string;
    tel?: string;
    slackChannel?: string;
  };
  contracts: WizardContractInput[];
  assignments: WizardAssignmentInput[];
  /** UI 表示用 (CS 担当者の表示名) */
  primaryOwnerName?: string;
};

export type WizardSaveResult =
  | { ok: true; companyId: string }
  | { ok: false; error: string };

function buildMemo(p: WizardSavePayload): string | undefined {
  const lines = [
    p.company.memo ?? "",
    p.company.employeeSize ? `従業員規模: ${p.company.employeeSize}` : "",
    p.company.websiteUrl ? `URL: ${p.company.websiteUrl}` : "",
    p.company.foundedYear ? `設立: ${p.company.foundedYear}` : "",
    p.company.corporateNumber ? `法人番号: ${p.company.corporateNumber}` : "",
    p.contact?.slackChannel ? `Slack: ${p.contact.slackChannel}` : ""
  ].filter((s) => s.length > 0);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function deriveContractStatus(c: WizardContractInput): ContractStatus {
  // 開始日が未来 → handoff、過去 → active を既定とする
  const start = Date.parse(c.startDate);
  if (!Number.isFinite(start)) return "handoff";
  return start > Date.now() ? "handoff" : "active";
}

export async function saveCompanyWizard(
  payload: WizardSavePayload
): Promise<WizardSaveResult> {
  if (!payload.company.name?.trim()) {
    return { ok: false, error: "企業名は必須です" };
  }

  try {
    const repo = getRepo();
    const orgId = payload.organizationId ?? DEFAULT_ORG_ID;

    // 1) companies
    const productCodes = payload.contracts.map((c) => c.product);
    const totalAnnual = payload.contracts.reduce(
      (sum, c) => sum + (c.annualRevenueJpy ?? 0),
      0
    );
    const company = await repo.companies.create({
      organizationId: orgId,
      name: payload.company.name.trim(),
      kana: payload.company.kana?.trim() ?? "",
      industry: payload.company.industry || "未設定",
      address: payload.company.address ?? "",
      ownerName: payload.primaryOwnerName ?? "未割当",
      contracts: productCodes,
      mrr: Math.round(totalAnnual / 12),
      lastTouchDays: 0,
      memo: buildMemo(payload),
      // is_demo を repo に伝搬。未指定なら true (本番開始前のフェーズ)
      isDemo: payload.company.isDemo ?? true
    });

    // 2) company_contacts (任意)
    if (payload.contact && payload.contact.name.trim()) {
      try {
        await repo.contacts.create({
          companyId: company.id,
          organizationId: orgId,
          name: payload.contact.name.trim(),
          department: payload.contact.department ?? "",
          title: payload.contact.title ?? "",
          email: payload.contact.email ?? "",
          tel: payload.contact.tel || undefined,
          isPrimary: true,
          products: productCodes
        });
      } catch (e) {
        // 担当窓口の登録失敗は致命ではないので警告ログのみ
        console.warn("[saveCompanyWizard] contact create failed", e);
      }
    }

    // 3) contracts (任意ステップ)
    for (const c of payload.contracts) {
      try {
        await repo.contracts.create({
          organizationId: orgId,
          companyId: company.id,
          product: c.product,
          courseKey: c.courseKey ?? c.product,
          planName: c.planName,
          startDate: c.startDate,
          endDate: c.endDate,
          mrr: c.annualRevenueJpy
            ? Math.round(c.annualRevenueJpy / 12)
            : undefined,
          revenue: c.annualRevenueJpy,
          ownerName: payload.primaryOwnerName ?? "未割当",
          participants: c.participants ?? 0,
          cycleNumber: 1,
          status: deriveContractStatus(c)
        });
      } catch (e) {
        console.warn("[saveCompanyWizard] contract create failed", e);
      }
    }

    // 4) assignments (任意ステップ)
    for (const a of payload.assignments) {
      if (!a.userId) continue;
      try {
        await repo.assignments.assign({
          organizationId: orgId,
          companyId: company.id,
          userId: a.userId,
          role: a.role
        });
      } catch (e) {
        console.warn("[saveCompanyWizard] assignment create failed", e);
      }
    }

    return { ok: true, companyId: company.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
