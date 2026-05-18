// AI 抽出の承認時に作成する CompanyTask 入力を構築する純関数。
//
// スコープ (Phase A): 承認時のみ呼ぶ。却下時は副作用なし。
// extraction.companyId が未確定の場合は null を返す (呼び側で skip)。
// 副作用接続は CompanyTask 作成のみに絞る (churnSignal / expansion は
// contractId 必須なため次フェーズ)。

import type {
  AiExtraction,
  AiExtractionType,
  CompanyTaskCreateInput
} from "@/lib/repository/types";
import type {
  CompanyTaskCategory,
  CompanyTaskPriority
} from "@/lib/domain/tasks/task";

type TaskShape = {
  category: CompanyTaskCategory;
  priority: CompanyTaskPriority;
  titlePrefix: string;
};

// company_suggestion は除外 (会社マッピング自体は別 UI で扱う)
const TASK_SHAPE: Partial<Record<AiExtractionType, TaskShape>> = {
  meeting_request: {
    category: "meeting_schedule",
    priority: "high",
    titlePrefix: "面談調整"
  },
  risk_signal: {
    category: "followup",
    priority: "high",
    titlePrefix: "リスク対応"
  },
  churn_signal: {
    category: "followup",
    priority: "urgent",
    titlePrefix: "解約予兆フォロー"
  },
  expansion_signal: {
    category: "followup",
    priority: "med",
    titlePrefix: "拡張機会"
  },
  progress_signal: {
    category: "other",
    priority: "low",
    titlePrefix: "進捗反映"
  }
};

function clip(s: string, n: number): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > n ? `${trimmed.slice(0, n)}…` : trimmed;
}

export type CompanyTaskFromExtraction = Omit<
  CompanyTaskCreateInput,
  "organizationId"
> & {
  companyId: string;
};

/**
 * 承認された AI 抽出から CompanyTask の作成入力を組み立てる。
 * 副作用化できない種別 (company_suggestion / companyId なし) は null。
 */
export function buildTaskInputFromExtraction(
  extraction: AiExtraction,
  opts: { createdBy?: string } = {}
): CompanyTaskFromExtraction | null {
  if (!extraction.companyId) return null;
  const shape = TASK_SHAPE[extraction.extractionType];
  if (!shape) return null;

  const titleBody = clip(extraction.excerpt, 60);
  const description = [
    extraction.suggestedAction?.trim(),
    extraction.excerpt?.trim()
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    companyId: extraction.companyId,
    title: `${shape.titlePrefix}: ${titleBody}`,
    description: description || undefined,
    category: shape.category,
    priority: shape.priority,
    createdBy: opts.createdBy
  };
}
