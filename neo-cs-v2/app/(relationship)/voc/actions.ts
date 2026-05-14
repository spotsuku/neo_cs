"use server";

// VOC 関連 Server Actions
//
// VocBoard / VocScanButton から呼ばれる。
// 旧コードはクライアントから vocItemRepo を直接叩いていたため本番でも mock を読み書きしていた。

import { revalidatePath } from "next/cache";
import {
  vocItemRepo,
  userRepo,
  DEFAULT_ORG_ID
} from "@/lib/repository/server";
import type {
  VocItemRecord,
  VocStatus,
  VocPriority,
  VocSourceType
} from "@/lib/repository/server";
import {
  enqueueNotification,
  resolvePrimaryAssignee
} from "@/lib/notifications/inbox";

// ─────────────────────────────────────────────
// 一覧取得 (VocBoard.reload 用)
// ─────────────────────────────────────────────
export async function listVocItemsAction(): Promise<VocItemRecord[]> {
  return vocItemRepo.list();
}

// ─────────────────────────────────────────────
// 新規作成
// ─────────────────────────────────────────────
export type CreateVocItemInput = {
  sourceType: VocSourceType;
  sourceId: string;
  contractId?: string;
  companyId?: string;
  excerpt: string;
  tags: string[];
  status?: VocStatus;
  priority?: VocPriority;
  /** 作成後にこの担当者を割り当てる場合 */
  assignedTo?: string;
};

export async function createVocItemAction(
  input: CreateVocItemInput
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const me = await userRepo.getCurrent();
    const created = await vocItemRepo.create({
      organizationId: DEFAULT_ORG_ID,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      contractId: input.contractId,
      companyId: input.companyId,
      excerpt: input.excerpt,
      tags: input.tags,
      status: input.status ?? "open",
      priority: input.priority ?? "med",
      createdBy: me?.id
    });
    if (input.assignedTo) {
      await vocItemRepo.setAssignedTo(created.id, input.assignedTo);
    }
    // 通知: assignedTo が指定されていればその人へ、なければ primary 担当者へ
    const targetUserId = input.assignedTo
      ?? (input.companyId ? await resolvePrimaryAssignee(input.companyId) : undefined);
    if (targetUserId) {
      await enqueueNotification({
        userId: targetUserId,
        category: "alert",
        title: "VOCが追加されました",
        body: input.excerpt.slice(0, 120),
        linkHref: input.companyId ? `/companies/${input.companyId}` : "/voc",
        relatedCompanyId: input.companyId,
        relatedContractId: input.contractId,
        sourceType: "voc",
        sourceId: created.id
      });
    }
    revalidatePath("/voc");
    return { ok: true, id: created.id };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e)
    };
  }
}

// ─────────────────────────────────────────────
// ステータス変更
// ─────────────────────────────────────────────
export async function setVocStatusAction(
  id: string,
  status: VocStatus
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const me = await userRepo.getCurrent();
    await vocItemRepo.setStatus(id, { status, actorUserId: me?.id });
    revalidatePath("/voc");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────
// 優先度変更
// ─────────────────────────────────────────────
export async function setVocPriorityAction(
  id: string,
  priority: VocPriority
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await vocItemRepo.setPriority(id, priority);
    revalidatePath("/voc");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────
// 担当者変更
// ─────────────────────────────────────────────
export async function setVocAssigneeAction(
  id: string,
  userId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await vocItemRepo.setAssignedTo(id, userId ?? undefined);
    revalidatePath("/voc");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────
// タグ変更
// ─────────────────────────────────────────────
export async function setVocTagsAction(
  id: string,
  tags: string[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await vocItemRepo.setTags(id, tags);
    revalidatePath("/voc");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────
// コメント追加
// ─────────────────────────────────────────────
export async function appendVocCommentAction(
  id: string,
  body: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const trimmed = body.trim();
    if (!trimmed) return { ok: false, message: "本文が空です" };
    const me = await userRepo.getCurrent();
    if (!me) return { ok: false, message: "ユーザー情報を取得できませんでした" };
    await vocItemRepo.appendComment(id, { authorUserId: me.id, body: trimmed });
    revalidatePath("/voc");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
