"use server";

// 次期サイクル作成 Server Action
//
// 「内諾」ステージ遷移時に呼び出される。1つの操作で:
//   1. 次期 ActiveContract を起票（previousContractId を現契約に紐付け）
//   2. 現契約の事業ジャーニーを stage='consent' に遷移
//   3. 次期契約のオンボードチェックリストを自動生成
//   4. 次期契約に「立ち上げ」ステージの BusinessJourney を作成
//   5. 次期契約のチェックポイント (kickoff) を初期化（全 pending）

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { productOnboardingTemplates, filterTemplateByCourse } from "@/lib/mock/onboarding";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { ContractOnboardingItem } from "@/lib/repository/types";

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createNextCycleAction(input: {
  /** 現契約 (今期) ID */
  currentContractId: string;
  /** 表示用 (revalidate 用) */
  companyId: string;
  /** 次期 開始日 (YYYY-MM-DD) */
  startDate: string;
  /** 次期 終了日 */
  endDate: string;
  /** 次期 MRR */
  mrr: number;
  /** 次期 担当者名 (空なら現契約から継承) */
  ownerName?: string;
  /** 次期 参加人数 (空なら現契約から継承) */
  participants?: number;
  /** 次期 コース key (空なら現契約から継承) */
  courseKey?: string;
  /** 内諾時のメモ */
  consentNote?: string;
}): Promise<
  | { ok: true; nextContractId: string }
  | { ok: false; message: string }
> {
  const repo = getRepo();
  try {
    const current = await repo.contracts.getById(input.currentContractId);
    if (!current) {
      return { ok: false, message: "現契約が見つかりません" };
    }

    // ─── 1. 次期契約を起票 ───
    const nextCycleNumber = current.cycleNumber + 1;
    const nextContract = await repo.contracts.create({
      companyId: current.companyId,
      product: current.product,
      courseKey: input.courseKey ?? current.courseKey,
      startDate: input.startDate,
      endDate: input.endDate,
      mrr: input.mrr,
      ownerName: input.ownerName?.trim() || current.ownerName,
      participants: input.participants ?? current.participants,
      cycleNumber: nextCycleNumber,
      previousContractId: current.id,
      status: "onboarding"
    });

    // ─── 2. 現契約の事業ジャーニーを consent に遷移 ───
    await repo.businessJourneys.setStage({
      contractId: current.id,
      toStageKey: "consent",
      acknowledgeRegression: false,
      note: input.consentNote
    });

    // ─── 3. 次期契約のオンボードチェックリスト自動生成 ───
    // 次期契約の courseKey に該当する項目（＋全コース共通）だけを展開
    const template = filterTemplateByCourse(
      productOnboardingTemplates[current.product] ?? [],
      nextContract.courseKey
    );
    const newItems: ContractOnboardingItem[] = template.flatMap((cat) =>
      cat.items.map((item) => ({
        id: `${nextContract.id}-${cat.key}-${item.key}`,
        contractId: nextContract.id,
        organizationId: DEFAULT_ORG_ID,
        categoryKey: cat.key,
        itemKey: item.key,
        name: item.name,
        dueDate: offsetDate(input.startDate, item.dueOffsetDays),
        assignee: input.ownerName ?? current.ownerName,
        status: "todo" as const,
        required: item.required
      }))
    );
    await repo.onboardingItems.createBatch(newItems);

    // ─── 4. 次期契約の事業ジャーニー (kickoff) を初期化 ───
    await repo.businessJourneys.setStage({
      contractId: nextContract.id,
      toStageKey: "kickoff",
      acknowledgeRegression: false,
      note: `第${nextCycleNumber}期 開始`
    });

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/programs/products");
    return { ok: true, nextContractId: nextContract.id };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
