"use server";

// 企業詳細ページ「業務ToDo」セクションの Server Actions
// クライアントから JSON で受け取り、REPO_DRIVER 切替の getRepo() に流す。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type {
  CompanyTaskCategory,
  CompanyTaskPriority,
  CompanyTaskStatus
} from "@/lib/repository/types";

export type CreateTaskInput = {
  companyId: string;
  contractId?: string;
  title: string;
  description?: string;
  category?: CompanyTaskCategory;
  priority: CompanyTaskPriority;
  dueDate?: string;
  assignedTo?: string;
};

export async function createCompanyTask(input: CreateTaskInput): Promise<void> {
  if (!input.title || !input.title.trim()) {
    throw new Error("title is required");
  }
  const repo = getRepo();
  const me = await repo.users.getCurrent().catch(() => null);
  await repo.companyTasks.create({
    companyId: input.companyId,
    contractId: input.contractId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    category: input.category,
    priority: input.priority,
    dueDate: input.dueDate,
    assignedTo: input.assignedTo,
    createdBy: me?.id
  });
  revalidatePath(`/companies/${input.companyId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function setCompanyTaskStatus(
  id: string,
  status: CompanyTaskStatus,
  companyId: string
): Promise<void> {
  const repo = getRepo();
  const me = await repo.users.getCurrent().catch(() => null);
  if (status === "done") {
    await repo.companyTasks.markDone(id, { completedBy: me?.id });
  } else if (status === "skipped") {
    await repo.companyTasks.markSkipped(id, { actorUserId: me?.id });
  } else if (status === "cancelled") {
    await repo.companyTasks.markCancelled(id, { actorUserId: me?.id });
  } else {
    await repo.companyTasks.update(id, { status });
  }
  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
}
