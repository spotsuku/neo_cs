"use server";

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type { ProgramCellStatus } from "@/lib/domain/program";

export async function setProgramCellStatus(
  cellId: string,
  termId: string,
  status: ProgramCellStatus
) {
  const repo = getRepo();
  await repo.programs.updateCell(cellId, { status });
  revalidatePath(`/programs/${termId}`);
}

export async function setProgramTemplateDueDate(
  templateId: string,
  termId: string,
  dueDate: string | null
) {
  const repo = getRepo();
  await repo.programs.setTemplateDueDate(templateId, dueDate);
  revalidatePath(`/programs/${termId}`);
}

export async function setProgramCellAssignee(
  cellId: string,
  termId: string,
  userId: string | null
) {
  const repo = getRepo();
  await repo.programs.updateCell(cellId, { assignedTo: userId });
  revalidatePath(`/programs/${termId}`);
}

export async function setProgramCellNote(
  cellId: string,
  termId: string,
  note: string | null
) {
  const repo = getRepo();
  await repo.programs.updateCell(cellId, { note });
  revalidatePath(`/programs/${termId}`);
}

export async function setProgramCellDueDate(
  cellId: string,
  termId: string,
  dueDate: string | null
) {
  const repo = getRepo();
  await repo.programs.updateCell(cellId, { dueDate });
  revalidatePath(`/programs/${termId}`);
}

// 列の責任者だけを設定 (open セルには反映しない)
export async function setProgramTemplateAssignee(
  templateId: string,
  termId: string,
  userId: string | null
) {
  const repo = getRepo();
  await repo.programs.setTemplateAssignee(templateId, userId, { propagate: false });
  revalidatePath(`/programs/${termId}`);
}

// 列の責任者を全 open セルに一括反映
export async function applyTemplateAssigneeToCells(
  templateId: string,
  termId: string,
  userId: string | null
) {
  const repo = getRepo();
  await repo.programs.setTemplateAssignee(templateId, userId, { propagate: true });
  revalidatePath(`/programs/${termId}`);
}

export async function updateProgramTemplateMeta(
  templateId: string,
  termId: string,
  patch: { label?: string; description?: string; orderNo?: number }
) {
  const repo = getRepo();
  await repo.programs.updateTemplateMeta(templateId, patch);
  revalidatePath(`/programs/${termId}`);
  revalidatePath(`/programs/${termId}/edit`);
}

export async function addProgramTemplate(
  termId: string,
  input: { label: string; description?: string; orderNo: number }
) {
  if (!input.label?.trim()) throw new Error("label is required");
  const repo = getRepo();
  await repo.programs.upsertTemplate({
    programTermId: termId,
    orderNo: input.orderNo,
    label: input.label.trim(),
    description: input.description?.trim() || undefined
  });
  // 新しいテンプレに対しても対象企業 × セルを生成
  await repo.programs.syncCompanies(termId);
  revalidatePath(`/programs/${termId}`);
  revalidatePath(`/programs/${termId}/edit`);
  revalidatePath(`/programs`);
}

export async function deleteProgramTemplate(
  templateId: string,
  termId: string
) {
  const repo = getRepo();
  await repo.programs.deleteTemplate(templateId);
  revalidatePath(`/programs/${termId}`);
  revalidatePath(`/programs/${termId}/edit`);
  revalidatePath(`/programs`);
}
