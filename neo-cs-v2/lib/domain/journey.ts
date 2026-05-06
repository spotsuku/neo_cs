// 企業ジャーニー / 事業ジャーニー の「おすすめステージ」算出ロジック
//
// 純関数として実装し、UI / Server Action から再利用する。
// 入力はリポジトリから取得した raw データ、出力は推奨 stageKey + 根拠 (reasons)。
// 既定ステージ (DEFAULT_COMPANY_STAGES / DEFAULT_BUSINESS_STAGES) を前提に
// 設計しているが、stageKey が同じであればカスタム定義でも動作する。

import type {
  BusinessJourney,
  CompanyJourney,
  Contract,
  ContractStatus,
  HealthScore,
  JourneyStageDefinition
} from "@/lib/repository/types";

// ─────────────────────────────────────────────
// 共通ヘルパー
// ─────────────────────────────────────────────

export type JourneySuggestion = {
  /** 推奨 stageKey。判断材料が薄い場合は null */
  suggestedStageKey: string | null;
  /** 推奨理由 (UIで箇条書き表示) */
  reasons: string[];
  /** 信頼度。high = 強い推奨、low = 参考程度 */
  confidence: "high" | "medium" | "low";
};

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function pickStage(
  defs: JourneyStageDefinition[],
  stageKey: string
): JourneyStageDefinition | undefined {
  return defs.find((d) => d.stageKey === stageKey);
}

// ─────────────────────────────────────────────
// 事業ジャーニー: 推奨算出
// ─────────────────────────────────────────────
//
// 判定ルール (上から順に評価):
//  - status=churned → 推奨なし
//  - status=handoff/onboarding → "kickoff"
//  - active で契約開始から 90日以内 → "kickoff" or "running"
//  - active で開始から 90 日以上経過 → "running" → "value_articulated"
//  - renewal_window 突入 → "renewal_consideration"
//  - 旧 RenewalMilestone (T-120/90/60/30) ベースの推奨は廃止。
//    詳細ステージ (internal_share〜upsell) への遷移はチェックポイント /
//    program_company_tasks の進捗を見てユーザーが手動で進める方針。

export type SuggestBusinessStageInput = {
  contract: Pick<Contract, "id" | "status" | "startDate" | "endDate" | "healthScore">;
  /** 既存ジャーニー (現在ステージとの比較用) */
  current?: BusinessJourney | null;
  /** 評価日 (テスト容易性のため注入可) */
  asOfIso?: string;
  stageDefinitions: JourneyStageDefinition[];
};

export function suggestBusinessStage(
  input: SuggestBusinessStageInput
): JourneySuggestion {
  const { contract, stageDefinitions } = input;
  const today = (input.asOfIso ?? new Date().toISOString()).slice(0, 10);
  const reasons: string[] = [];

  if (contract.status === "churned") {
    return { suggestedStageKey: null, reasons: ["解約済み契約のため推奨なし"], confidence: "low" };
  }

  // 引き継ぎ・オンボ中
  if (contract.status === "handoff" || contract.status === "onboarding") {
    reasons.push(`契約ステータス: ${contract.status}`);
    return tryPick("kickoff", stageDefinitions, reasons, "high");
  }

  // 更新ウィンドウ突入
  if (contract.status === "renewal_window") {
    reasons.push("更新ウィンドウ (期末90日以内) 突入");
    return tryPick("renewal_consideration", stageDefinitions, reasons, "high");
  }

  // 通常運用
  const since = daysBetween(contract.startDate, today);
  if (since < 90) {
    reasons.push(`契約開始から ${since} 日 (90日以内)`);
    return tryPick("kickoff", stageDefinitions, reasons, "medium");
  }
  if (since < 180) {
    reasons.push(`契約開始から ${since} 日 (運用初期)`);
    return tryPick("running", stageDefinitions, reasons, "medium");
  }
  reasons.push(`契約開始から ${since} 日 (中盤以降)`);
  if (contract.healthScore?.color === "green") {
    reasons.push("ヘルス green → 成果が見えている可能性");
    return tryPick("value_articulated", stageDefinitions, reasons, "medium");
  }
  return tryPick("running", stageDefinitions, reasons, "low");
}

// ─────────────────────────────────────────────
// 企業ジャーニー: 推奨算出
// ─────────────────────────────────────────────
//
// 判定ルール:
//  - 全契約が churned → "value_perception" 以下に下げる候補 (低信頼)
//  - active 契約が一切ない & 過去にもなし → "interest" or "first_touch"
//  - active 契約が 1本ある & 開始から 90 日以内 → "first_touch"
//  - active 1本以上 & 90日経過 → "value_perception" 〜 "small_win"
//  - 事業ジャーニーで "upsell" 到達した契約が 1 件以上 → "partner"
//  - 事業ジャーニーで "renewed" 到達かつ複数事業稼働 → "investment_view"
//  - 事業ジャーニーで "value_articulated" 以上が 1 件以上 → "small_win" / "internal_spread"

export type SuggestCompanyStageInput = {
  /** 当該 company に紐づく全契約 */
  contracts: Pick<Contract, "id" | "status" | "startDate" | "cycleNumber">[];
  /** 当該 company に紐づく事業ジャーニー (契約ID単位) */
  businessJourneys: BusinessJourney[];
  /** 既存企業ジャーニー (現在ステージとの比較用) */
  current?: CompanyJourney | null;
  asOfIso?: string;
  companyStageDefinitions: JourneyStageDefinition[];
  businessStageDefinitions: JourneyStageDefinition[];
};

export function suggestCompanyStage(
  input: SuggestCompanyStageInput
): JourneySuggestion {
  const today = (input.asOfIso ?? new Date().toISOString()).slice(0, 10);
  const reasons: string[] = [];
  const { contracts, businessJourneys, companyStageDefinitions: defs, businessStageDefinitions: bDefs } = input;

  const activeContracts = contracts.filter(
    (c) => c.status !== "churned" && c.status !== "renewed"
  );
  const renewedContracts = contracts.filter((c) => c.status === "renewed");
  const hasMultiCycle = contracts.some((c) => c.cycleNumber >= 2);

  // 事業ジャーニーの最高到達 displayOrder を引く
  const bDefByKey = new Map(bDefs.map((d) => [d.stageKey, d]));
  const maxBusinessOrder = Math.max(
    0,
    ...businessJourneys
      .map((bj) => bDefByKey.get(bj.currentStageKey)?.displayOrder ?? 0)
  );
  const reachedKey = (k: string) =>
    businessJourneys.some((bj) => {
      const o = bDefByKey.get(bj.currentStageKey)?.displayOrder ?? 0;
      const target = bDefByKey.get(k)?.displayOrder ?? Infinity;
      return o >= target;
    });

  // (1) アップセル到達 → パートナー化
  if (reachedKey("upsell")) {
    reasons.push("いずれかの事業で「9.アップセル快諾」到達");
    return tryPick("partner", defs, reasons, "high");
  }

  // (2) 複数事業 + renewed 経験 → 投資対象
  if (renewedContracts.length >= 1 && contracts.length >= 2) {
    reasons.push("複数事業で稼働 + 更新実績あり");
    return tryPick("investment_view", defs, reasons, "high");
  }
  if (hasMultiCycle) {
    reasons.push("2期目以降の契約あり (継続実績)");
    return tryPick("internal_spread", defs, reasons, "medium");
  }

  // (3) 事業ジャーニーで成果言語化以上 → 社内浸透
  if (maxBusinessOrder >= (bDefByKey.get("value_articulated")?.displayOrder ?? 99)) {
    reasons.push("いずれかの事業で「3.成果の言語化」以上に到達");
    return tryPick("internal_spread", defs, reasons, "medium");
  }
  if (maxBusinessOrder >= (bDefByKey.get("running")?.displayOrder ?? 99)) {
    reasons.push("いずれかの事業で「2.運用・初期成果」以上に到達");
    return tryPick("small_win", defs, reasons, "medium");
  }

  // (4) アクティブ契約の経過日数で判定
  if (activeContracts.length === 0 && contracts.length === 0) {
    reasons.push("契約実績なし");
    return tryPick("interest", defs, reasons, "low");
  }
  if (activeContracts.length >= 1) {
    const minSince = Math.min(
      ...activeContracts.map((c) => daysBetween(c.startDate, today))
    );
    if (minSince < 90) {
      reasons.push(`契約開始から ${minSince} 日 (初期接触段階)`);
      return tryPick("first_touch", defs, reasons, "medium");
    }
    reasons.push(`契約開始から ${minSince} 日`);
    return tryPick("value_perception", defs, reasons, "medium");
  }

  return { suggestedStageKey: null, reasons: ["判断材料が不足"], confidence: "low" };
}

// ─────────────────────────────────────────────
// 内部ユーティリティ
// ─────────────────────────────────────────────

function tryPick(
  stageKey: string,
  defs: JourneyStageDefinition[],
  reasons: string[],
  confidence: "high" | "medium" | "low"
): JourneySuggestion {
  const def = pickStage(defs, stageKey);
  if (!def) {
    return {
      suggestedStageKey: null,
      reasons: [...reasons, `(stage "${stageKey}" がカスタム定義から削除されている)`],
      confidence: "low"
    };
  }
  return { suggestedStageKey: stageKey, reasons, confidence };
}

// ─────────────────────────────────────────────
// 後退判定 (UIの注意喚起用)
// ─────────────────────────────────────────────
export function isRegression(
  defs: JourneyStageDefinition[],
  fromStageKey: string | undefined,
  toStageKey: string
): boolean {
  if (!fromStageKey) return false;
  const from = pickStage(defs, fromStageKey);
  const to = pickStage(defs, toStageKey);
  if (!from || !to) return false;
  return to.displayOrder < from.displayOrder;
}
