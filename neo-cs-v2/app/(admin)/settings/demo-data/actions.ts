"use server";

// /settings/demo-data の Server Actions
//
// admin only (middleware で /settings/demo-data はadmin要件にしている)。
// ここでは追加で repo.users.getCurrent() の role が admin かを再確認する。

import { getRepo } from "@/lib/repository/server";
import {
  canExecuteWipe,
  type DemoRange
} from "@/lib/domain/demo-data/demo-data";
import type { DemoWipeRange } from "@/lib/repository/types";

type DeleteOneResult = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<{ ok: true; userId?: string; email?: string } | { ok: false; error: string }> {
  const repo = getRepo();
  try {
    const me = await repo.users.getCurrent();
    if (!me) return { ok: false, error: "未ログインです" };
    if (me.role !== "admin") return { ok: false, error: "admin 権限が必要です" };
    return { ok: true, userId: me.id, email: me.email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteOneDemoCompany(
  companyId: string
): Promise<DeleteOneResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  if (!companyId) return { ok: false, error: "companyId 必須" };

  try {
    const repo = getRepo();
    const target = await repo.companies.getById(companyId);
    if (!target) return { ok: false, error: "対象が見つかりません" };
    if (target.isDemo === false) {
      return { ok: false, error: "is_demo=false の企業は本画面から削除できません" };
    }
    // CASCADE 削除を期待 (mock は単純 splice、supabase は FK CASCADE)
    await repo.companies.delete(companyId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type WipeResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

export async function wipeDemoData(input: {
  range: DemoRange;
  confirmInput: string;
  selectedCount: number;
}): Promise<WipeResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;

  const check = canExecuteWipe({
    confirmInput: input.confirmInput,
    selectedCount: input.selectedCount
  });
  if (!check.ok) return { ok: false, error: check.reason };

  try {
    const repo = getRepo();
    const range: DemoWipeRange = input.range;
    const result = await repo.companies.wipeDemoData({
      range,
      actorUserId: guard.userId,
      actorEmail: guard.email
    });
    return { ok: true, deletedCount: result.deletedCompanies };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function promoteToProd(companyId: string): Promise<DeleteOneResult> {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;
  try {
    const repo = getRepo();
    await repo.companies.update(companyId, { isDemo: false });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
