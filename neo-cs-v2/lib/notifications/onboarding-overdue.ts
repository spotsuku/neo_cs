/**
 * オンボーディング期限超過 → inbox 通知ディスパッチャ (F1)
 *
 * 役割:
 *   - onboarding_tasks の dueDate を過ぎても status が done/not_applicable 以外の項目を検出
 *   - 担当者 (item.assignee があればそのユーザー、なければ企業の primary owner) の inbox に通知
 *   - user_notifications の dedup (userId + sourceType + sourceId) により
 *     同一項目に対する重複通知を抑止
 *
 * 設計判断:
 *   - sourceType="onboarding_task" / sourceId=item.id とし、
 *     userNotificationRepo.create の dedup (user_id, source_type, source_id) に頼る。
 *     overdue が解消されない限り、同じ項目で2件目以降は生成されない。
 *   - renewed/churned 契約は対象外 (activeOnly に相当する自前フィルタ)。
 *   - assignee が未設定なら primary owner にフォールバック (resolvePrimaryAssignee)。
 *     primary 不在の場合はスキップして errors にも積まない (静かに skipped)。
 */

import "server-only";
import {
  contractRepo,
  onboardingItemRepo,
  companyRepo
} from "@/lib/repository/server";
import { enqueueNotification, resolvePrimaryAssignee } from "./inbox";

function todayIsoDate(): string {
  // YYYY-MM-DD (UTC基準。dueDate も同形式の日付文字列なので文字列比較で十分)
  return new Date().toISOString().slice(0, 10);
}

export async function dispatchOnboardingOverdueNotifications(): Promise<{
  scanned: number;
  notified: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let notified = 0;
  let skipped = 0;

  const today = todayIsoDate();

  const allContracts = await contractRepo.list();
  const activeContracts = allContracts.filter(
    (c) => c.status !== "renewed" && c.status !== "churned"
  );
  const activeContractIds = activeContracts.map((c) => c.id);
  const contractById = new Map(activeContracts.map((c) => [c.id, c]));

  if (activeContractIds.length === 0) {
    return { scanned: 0, notified: 0, skipped: 0, errors };
  }

  const items = await onboardingItemRepo.listByContractIds(activeContractIds);

  // 期限超過 (dueDate <= today) かつ未完了 (done/not_applicable 以外) のみ
  const overdue = items.filter((it) => {
    if (it.status === "done" || it.status === "not_applicable") return false;
    if (!it.dueDate) return false;
    return it.dueDate <= today;
  });

  for (const item of overdue) {
    const contract = contractById.get(item.contractId);
    if (!contract) {
      skipped++;
      continue;
    }
    try {
      // assignee は app_users.id を期待。なければ primary owner にフォールバック
      let targetUserId: string | undefined = item.assignee
        ? item.assignee
        : await resolvePrimaryAssignee(contract.companyId);
      if (!targetUserId) {
        skipped++;
        continue;
      }

      const company = await companyRepo.getById(contract.companyId);
      const companyName = company?.name ?? contract.companyId;
      const cyclePart = contract.cycleNumber ? `${contract.cycleNumber}期` : "";
      const bodyParts = [
        companyName,
        contract.product,
        cyclePart,
        `${item.dueDate} 期限`
      ].filter((s) => s && s.length > 0);

      await enqueueNotification({
        userId: targetUserId,
        category: "onboarding",
        title: `オンボ期限超過: ${item.name}`,
        body: bodyParts.join(" "),
        linkHref: `/companies/${contract.companyId}`,
        relatedCompanyId: contract.companyId,
        relatedContractId: contract.id,
        sourceType: "onboarding_task",
        sourceId: item.id
      });
      notified++;
    } catch (e) {
      errors.push(
        `[${item.id}] ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { scanned: overdue.length, notified, skipped, errors };
}
