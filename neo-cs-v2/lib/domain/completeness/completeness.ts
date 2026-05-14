// 企業データ完成度チェック (純関数)
//
// 設計原則:
//   - Repository 非依存。必要なファクトデータを引数で受け取る純関数
//   - mock / supabase いずれの呼び出し側からも同じシグネチャで利用可
//   - 各カテゴリ × 必須項目をルール定義し、入力済み/未入力を判定
//   - スコアは「入力済み件数 / 必須件数 × 100」のシンプルな比率
//   - 各項目には category と editHref を持ち、UIから該当編集画面へ誘導可
//
// カテゴリ:
//   1. basic     基本情報 (会社名 / 業種 / 規模 / Webサイト)
//   2. contract  契約情報 (アクティブ契約 / コース / 金額 / 期間)
//   3. assign    アサイン (primary CS / sales_owner)
//   4. onboard   オンボ (タスク開始)
//   5. drive     共有Drive (フォルダURL ※ Phase4 実装予定の placeholder)

export type ChecklistCategory =
  | "basic"
  | "contract"
  | "assign"
  | "onboard"
  | "drive";

export const CHECKLIST_CATEGORY_LABEL: Record<ChecklistCategory, string> = {
  basic: "基本情報",
  contract: "契約情報",
  assign: "アサイン",
  onboard: "オンボーディング",
  drive: "共有Drive"
};

export type ChecklistItemKey =
  // basic
  | "basic.name"
  | "basic.industry"
  | "basic.size"
  | "basic.website"
  // contract
  | "contract.hasActive"
  | "contract.course"
  | "contract.mrr"
  | "contract.period"
  // assign
  | "assign.primaryCs"
  | "assign.salesOwner"
  // onboard
  | "onboard.tasksStarted"
  // drive
  | "drive.folderUrl";

export type ChecklistItem = {
  key: ChecklistItemKey;
  category: ChecklistCategory;
  label: string;
  /** 該当の編集画面 (フラグメント識別子付き) */
  editHref: string;
  filled: boolean;
  /** 未入力時の補足ヒント */
  hint?: string;
  /** Phase4 等で実装予定の項目は scoreOptional=true（合計分母から除外） */
  scoreOptional?: boolean;
};

export type CompletenessResult = {
  score: number;        // 0..100
  filledCount: number;
  totalCount: number;
  items: ChecklistItem[];
  missingByCategory: Record<ChecklistCategory, ChecklistItem[]>;
};

// ─────────────────────────────────────────────
// 入力データ構造 (呼び出し側で必要分だけ詰める)
// ─────────────────────────────────────────────

export type CompanyCompletenessInput = {
  company: {
    id: string;
    name?: string | null;
    industry?: string | null;
    /** 規模 (社員数 or サイズ区分)。company.memo を流用するケースもあるため受け側で吸収 */
    size?: string | number | null;
    website?: string | null;
  };
  contacts: Array<{
    isPrimary?: boolean;
    name?: string | null;
    email?: string | null;
    title?: string | null;
    slackId?: string | null;
  }>;
  contracts: Array<{
    status?: string;
    courseKey?: string | null;
    mrr?: number | null;
    revenue?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  assignments?: Array<{
    role: string;          // "primary" | "secondary" | "observer" | "sales_owner"
    unassignedAt?: string | null;
  }>;
  /** 後方互換: assignments が無い場合は company.ownerName を primary CS とみなす */
  fallbackPrimaryOwnerName?: string | null;
  /** 後方互換: 内諾後判定。true のとき sales_owner も必須とする (デフォルトは contracts.length>0 で判断) */
  postHandoff?: boolean;
  onboarding: {
    /** 契約に紐づくオンボタスクが1件以上立っているか */
    taskCount: number;
  };
  drive?: {
    folderUrl?: string | null;
  };
};

// ─────────────────────────────────────────────
// 判定ヘルパ
// ─────────────────────────────────────────────

const isFilled = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
};

const ACTIVE_STATUSES = new Set(["handoff", "onboarding", "active", "renewal_window"]);

// ─────────────────────────────────────────────
// メイン: 完成度チェック
// ─────────────────────────────────────────────

export function checkCompanyCompleteness(input: CompanyCompletenessInput): CompletenessResult {
  const companyHref = `/companies/${input.company.id}`;
  const editHref = `${companyHref}#edit`;

  const activeContracts = input.contracts.filter((c) => ACTIVE_STATUSES.has(c.status ?? ""));
  const hasActive = activeContracts.length > 0;

  const primaryCsAssigned = input.assignments
    ? input.assignments.some((a) => a.role === "primary" && !a.unassignedAt)
    : isFilled(input.fallbackPrimaryOwnerName);
  const salesOwnerAssigned = input.assignments
    ? input.assignments.some((a) => a.role === "sales_owner" && !a.unassignedAt)
    : false;

  // 内諾後判定: 引数優先、なければ契約存在で代用
  const postHandoff = input.postHandoff ?? hasActive;

  const items: ChecklistItem[] = [
    // basic
    mk("basic.name", "basic", "会社名", editHref, isFilled(input.company.name)),
    mk("basic.industry", "basic", "業種", editHref, isFilled(input.company.industry)),
    mk("basic.size", "basic", "規模 (社員数)", editHref, isFilled(input.company.size), "事業規模感の把握に必要"),
    mk("basic.website", "basic", "Webサイト", editHref, isFilled(input.company.website)),

    // contract
    mk("contract.hasActive", "contract", "アクティブ契約あり", `${companyHref}?tab=contracts`, hasActive),
    mk("contract.course", "contract", "コース指定", `${companyHref}?tab=contracts`, hasActive && activeContracts.every((c) => isFilled(c.courseKey))),
    mk("contract.mrr", "contract", "契約金額", `${companyHref}?tab=contracts`, hasActive && activeContracts.some((c) => isFilled(c.mrr) || isFilled(c.revenue))),
    mk("contract.period", "contract", "期間 (開始/終了日)", `${companyHref}?tab=contracts`, hasActive && activeContracts.every((c) => isFilled(c.startDate) && isFilled(c.endDate))),

    // assign
    mk("assign.primaryCs", "assign", "primary CS担当", `${companyHref}#assign`, primaryCsAssigned),
    {
      key: "assign.salesOwner",
      category: "assign",
      label: "sales_owner (内諾後)",
      editHref: `${companyHref}#assign`,
      filled: postHandoff ? salesOwnerAssigned : true, // 内諾前は対象外 = 自動充足
      hint: postHandoff ? "内諾済みなので営業オーナー指定が必要" : undefined,
      scoreOptional: !postHandoff
    },

    // onboard
    mk("onboard.tasksStarted", "onboard", "オンボタスク開始", `${companyHref}?tab=onboarding`, input.onboarding.taskCount > 0),

    // drive (Phase4-#5 で本番化済。営業引継ぎ後は必須)
    {
      key: "drive.folderUrl",
      category: "drive",
      label: "共有フォルダURL",
      editHref: `${companyHref}#drive`,
      filled: isFilled(input.drive?.folderUrl),
      hint: postHandoff
        ? "handoff受信時に自動作成。失敗時は /api/integrations/drive/retry/[companyId] で再実行可"
        : "内諾後に自動生成されます",
      scoreOptional: !postHandoff
    }
  ];

  // スコアリング: scoreOptional=true は分母にも含めない
  const scored = items.filter((i) => !i.scoreOptional);
  const filledCount = scored.filter((i) => i.filled).length;
  const totalCount = scored.length;
  const score = totalCount === 0 ? 0 : Math.round((filledCount / totalCount) * 100);

  // カテゴリ別未入力 (scoreOptional 含む = UIには出す)
  const missingByCategory = items.reduce<Record<ChecklistCategory, ChecklistItem[]>>(
    (acc, it) => {
      if (!it.filled) acc[it.category].push(it);
      return acc;
    },
    { basic: [], contract: [], assign: [], onboard: [], drive: [] }
  );

  return { score, filledCount, totalCount, items, missingByCategory };
}

function mk(
  key: ChecklistItemKey,
  category: ChecklistCategory,
  label: string,
  editHref: string,
  filled: boolean,
  hint?: string
): ChecklistItem {
  return { key, category, label, editHref, filled, hint };
}

// ─────────────────────────────────────────────
// スコア → 色 (UI 用)
// ─────────────────────────────────────────────
export type CompletenessLevel = "high" | "medium" | "low";

export function completenessLevel(score: number): CompletenessLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}
