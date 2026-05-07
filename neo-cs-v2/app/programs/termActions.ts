"use server";

// 事業内ToDo の期 (term) 作成・複製アクション
// 権限: role_permissions.program_term_manage (既定 manager 以上)。
// admin が /settings/permissions で min_role を変更可能。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { requirePermission } from "@/lib/auth/role-permissions";
import type { ProgramTermStatus } from "@/lib/repository/types";

export type CreateTermInput = {
  productCode: string;
  courseKey?: string | null;
  cycleNo?: number | null;
  label: string;
  startedAt?: string;
  closedAt?: string;
  status?: ProgramTermStatus;
  /** 指定した term からタスク列 (テンプレ) を複製する */
  copyFromTermId?: string;
};

/**
 * 新しい期を作成 (オプションでテンプレを複製) してその ID を返す。
 * 呼び出し側でクライアント遷移する。
 */
export async function createProgramTerm(input: CreateTermInput): Promise<{
  termId: string;
  templatesCopied: number;
  cellsCreated: number;
}> {
  const ctx = await getPermissionContext();
  await requirePermission(ctx, "program_term_manage");

  if (!input.label || !input.label.trim()) {
    throw new Error("label is required");
  }
  if (!input.productCode) {
    throw new Error("productCode is required");
  }

  const repo = getRepo();
  const term = await repo.programs.createTerm({
    productCode: input.productCode,
    courseKey: input.courseKey ?? null,
    cycleNo: input.cycleNo ?? null,
    label: input.label.trim(),
    startedAt: input.startedAt,
    closedAt: input.closedAt,
    status: input.status ?? "active"
  });

  let templatesCopied = 0;
  if (input.copyFromTermId) {
    const r = await repo.programs.copyTemplates(input.copyFromTermId, term.id);
    templatesCopied = r.copied;
  }

  // 対象企業 × テンプレでセルを自動生成 (テンプレが0件なら何も生成されない)
  const sync = await repo.programs.syncCompanies(term.id);

  // 一覧と編集ページの両方を再検証しておく (router.push 後に新 term が即見える)
  revalidatePath("/programs");
  revalidatePath(`/programs/${term.id}`);
  revalidatePath(`/programs/${term.id}/edit`);
  return {
    termId: term.id,
    templatesCopied,
    cellsCreated: sync.created
  };
}

/** 期を完全削除する。関連テンプレ・セルも全部消える */
export async function deleteProgramTerm(termId: string): Promise<void> {
  const ctx = await getPermissionContext();
  await requirePermission(ctx, "program_term_manage");
  const repo = getRepo();
  await repo.programs.deleteTerm(termId);
  revalidatePath("/programs");
}
