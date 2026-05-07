"use server";

// 企業カルテ - 活動ログ追加 Server Action
// 事業横断の接点記録 (メール / 電話 / 面談・商談) を1件作成する。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import type { ProductCode, CompanyTaskPriority } from "@/lib/repository/types";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";

export type LogTaskSuggestion = {
  title: string;
  priority: CompanyTaskPriority;
  dueDate?: string;
};

export type LogVocSuggestion = {
  excerpt: string;
  tags?: string[];
  priority?: "low" | "med" | "high";
};

export type AddLogInput = {
  companyId: string;
  date: string;
  type: "mtg" | "mail" | "call"; // mail は既存ログ用 (新規追加 UI は mtg / call のみ)
  product: ProductCode | "cross";
  title: string;
  summary: string;
  good?: string;
  more?: string;
  next?: string;
  authorName: string;
  /** 面談/商談: Notion議事録 URL */
  notionUrl?: string;
  /** 電話: 発信元コンタクト (contacts.id) */
  callerContactId?: string;
  /** 採用された ToDo 候補 (個社ToDoとして作成) */
  taskSuggestions?: LogTaskSuggestion[];
  /** 採用された VOC 候補 (VOCに追加) */
  vocSuggestions?: LogVocSuggestion[];
};

export type AddLogResult =
  | {
      ok: true;
      tasksCreated: number;
      vocsCreated: number;
    }
  | { ok: false; message: string };

export async function addMeetingLogAction(input: AddLogInput): Promise<AddLogResult> {
  if (!input.title.trim()) return { ok: false, message: "タイトルを入力してください" };
  if (!input.date) return { ok: false, message: "日付を入力してください" };

  const repo = getRepo();
  const me = await repo.users.getCurrent().catch(() => null);

  const log = await repo.meetingLogs.create({
    companyId: input.companyId,
    date: input.date,
    type: input.type,
    product: input.product,
    title: input.title.trim(),
    summary: input.summary.trim(),
    good: input.good?.trim() || undefined,
    more: input.more?.trim() || undefined,
    next: input.next?.trim() || undefined,
    authorName: input.authorName,
    notionUrl: input.notionUrl?.trim() || undefined,
    callerContactId: input.callerContactId
  });

  let tasksCreated = 0;
  for (const t of input.taskSuggestions ?? []) {
    if (!t.title.trim()) continue;
    await repo.companyTasks.create({
      companyId: input.companyId,
      title: t.title.trim(),
      priority: t.priority,
      dueDate: t.dueDate,
      createdBy: me?.id
    });
    tasksCreated++;
  }

  let vocsCreated = 0;
  for (const v of input.vocSuggestions ?? []) {
    if (!v.excerpt.trim()) continue;
    await repo.vocItems.create({
      organizationId: DEFAULT_ORG_ID,
      sourceType: "meeting_log",
      sourceId: log.id,
      companyId: input.companyId,
      excerpt: v.excerpt.trim(),
      tags: v.tags ?? [],
      status: "open",
      priority: v.priority ?? "med",
      createdBy: me?.id
    });
    vocsCreated++;
  }

  revalidatePath(`/companies/${input.companyId}`);
  if (tasksCreated > 0) revalidatePath("/tasks");
  if (vocsCreated > 0) revalidatePath("/inbox/voc");

  return { ok: true, tasksCreated, vocsCreated };
}
