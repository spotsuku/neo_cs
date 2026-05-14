"use server";

// アカデミア解約時に評議会単独契約に切替える Server Action
//
// 動作:
//   1. 既存アカデミア契約を status="churned" に更新 (該当 ID 指定)
//   2. 新規 hyogikai 契約を作成 (cycleNumber=1 から始める)
//      ※ 評議会の参加履歴は getHyogikaiMemberSince() がアカデミア時代まで
//        遡って計算するため、新規契約でも会員資格としては継続扱い
//
// 引数:
//   - academiaContractId: 解約するアカデミア契約 ID
//   - companyId: 会社 ID
//   - newStartDate: 新しい評議会単独契約の startDate
//   - newEndDate: 新しい評議会単独契約の endDate (1年後想定)
//   - mrr: 評議会単独 MRR (デフォルト 150,000)

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";

export type SwitchToHyogikaiResult =
  | { ok: true; newContractId: string }
  | { ok: false; code: string; message: string };

export async function switchAcademiaToHyogikaiAction(input: {
  academiaContractId: string;
  companyId: string;
  newStartDate: string;
  newEndDate: string;
  mrr?: number;
  ownerName?: string;
  participants?: number;
}): Promise<SwitchToHyogikaiResult> {
  const repo = getRepo();
  try {
    const academia = await repo.contracts.getById(input.academiaContractId);
    if (!academia) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: `アカデミア契約 ${input.academiaContractId} が見つかりません`
      };
    }
    if (academia.product !== "academia") {
      return {
        ok: false,
        code: "INVALID_PRODUCT",
        message: "切替元はアカデミア契約である必要があります"
      };
    }

    // 1) アカデミアを churned に
    await repo.contracts.update(input.academiaContractId, {
      status: "churned"
    });

    // 2) 評議会単独契約を新規作成
    const created = await repo.contracts.create({
      companyId: input.companyId,
      product: "hyogikai",
      courseKey: "standard",
      startDate: input.newStartDate,
      endDate: input.newEndDate,
      mrr: input.mrr ?? 150_000,
      ownerName: input.ownerName ?? academia.ownerName,
      participants: input.participants ?? academia.participants ?? 3,
      cycleNumber: 1,
      status: "active",
      // 切替元のアカデミア契約 ID を previousContractId として記録 (評議会継続性の証跡)
      previousContractId: input.academiaContractId
    });

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    return { ok: true, newContractId: created.id };
  } catch (e) {
    const code = (e as { code?: string }).code ?? "UNKNOWN";
    return { ok: false, code, message: (e as Error).message };
  }
}
