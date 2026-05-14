"use server";

/**
 * プロダクトコース (product_courses) 編集 Server Actions
 *
 * - admin / manager のみ実行可
 * - service_role 経由で DB を更新 (Repository 層に委譲)
 * - 監査ログは Repository のフック (auditHook) で自動記録
 * - course_key (= コードID) の変更は契約 (contracts.course_key) を伴うため
 *   呼び出し元 (UI) で影響件数を事前確認 → confirmRename=true 必須
 */

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { userRepo } from "@/lib/repository/server";
import { withActorContext } from "@/lib/repository/supabase/_actor";

export type CourseDraft = {
  productCode: string;
  /** 既存レコード変更時の旧 course_key。新規なら未指定 */
  previousCourseKey?: string;
  courseKey: string;
  name: string;
  shortName?: string;
  description?: string;
  displayOrder?: number;
};

export type ActionResult<T = void> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

const COURSE_KEY_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$|^[a-z0-9]$/i;

function validateCourseKey(key: string): string | null {
  if (!key) return "コードIDは必須です";
  if (!COURSE_KEY_RE.test(key)) return "コードIDは半角英数とハイフンのみ使用できます (2〜40文字)";
  return null;
}

async function requireEditor() {
  const actor = await userRepo.getCurrent();
  if (!actor) return { error: "認証が確認できません" } as const;
  if (actor.role !== "admin" && actor.role !== "manager") {
    return { error: "コース編集は admin / manager のみ実行できます" } as const;
  }
  return { actor } as const;
}

export async function listCoursesAction(productCode: string) {
  const repo = getRepo();
  return repo.productCourses.listByProduct(productCode);
}

export async function countAffectedContractsAction(
  productCode: string,
  courseKey: string
): Promise<number> {
  const repo = getRepo();
  return repo.productCourses.countContractsByCourse(productCode, courseKey);
}

export async function upsertCourseAction(
  draft: CourseDraft,
  opts?: { confirmRename?: boolean }
): Promise<ActionResult> {
  const requestId = crypto.randomUUID();
  const auth = await requireEditor();
  if ("error" in auth && auth.error) return { ok: false, message: auth.error };
  if (!("actor" in auth)) return { ok: false, message: "認証エラー" };

  const keyErr = validateCourseKey(draft.courseKey);
  if (keyErr) return { ok: false, message: keyErr };
  if (!draft.name.trim()) return { ok: false, message: "コース名は必須です" };

  const repo = getRepo();

  // rename 検出 + 影響範囲ガード
  const isRename = !!draft.previousCourseKey && draft.previousCourseKey !== draft.courseKey;
  if (isRename) {
    const affected = await repo.productCourses.countContractsByCourse(
      draft.productCode,
      draft.previousCourseKey!
    );
    if (affected > 0 && !opts?.confirmRename) {
      return {
        ok: false,
        message: `コードIDの変更は ${affected} 件の既存契約に影響します。確認後に再実行してください`
      };
    }
  }

  try {
    await withActorContext(
      {
        actor: {
          userId: auth.actor.id,
          email: auth.actor.email,
          role: auth.actor.role,
          organizationId: auth.actor.organizationId
        },
        request: { id: requestId, ip: null, userAgent: null }
      },
      async () => {
        await repo.productCourses.upsert({
          productCode: draft.productCode,
          previousCourseKey: draft.previousCourseKey,
          courseKey: draft.courseKey,
          name: draft.name,
          shortName: draft.shortName ?? null,
          description: draft.description ?? null,
          displayOrder: draft.displayOrder
        });
      }
    );
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  revalidatePath(`/settings/products/${draft.productCode}`);
  revalidatePath("/settings/products");
  return { ok: true, message: "コースを保存しました" };
}

export async function deleteCourseAction(
  productCode: string,
  courseKey: string
): Promise<ActionResult> {
  const requestId = crypto.randomUUID();
  const auth = await requireEditor();
  if ("error" in auth && auth.error) return { ok: false, message: auth.error };
  if (!("actor" in auth)) return { ok: false, message: "認証エラー" };

  const repo = getRepo();

  try {
    await withActorContext(
      {
        actor: {
          userId: auth.actor.id,
          email: auth.actor.email,
          role: auth.actor.role,
          organizationId: auth.actor.organizationId
        },
        request: { id: requestId, ip: null, userAgent: null }
      },
      async () => {
        await repo.productCourses.delete(productCode, courseKey);
      }
    );
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  revalidatePath(`/settings/products/${productCode}`);
  revalidatePath("/settings/products");
  return { ok: true, message: "コースを削除しました" };
}
