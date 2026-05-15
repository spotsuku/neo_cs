// オンボーディングテンプレ + カスタマージャーニーのマスタ
// (旧 lib/mock/onboarding.ts から master へ切り出し)
//
// テンプレ本体は DB 化済 (onboarding_template_categories / _items) だが、
// 後方互換と journey 表示の defaults として保持する。
// 契約インスタンス (allContracts 等) は mock 専用なので lib/mock/onboarding.ts に残す。

import type { ProductCode } from "./products";
import type { Contract } from "@/lib/mock/contracts";

// ─────────────────────────────────────────────
// オンボテンプレ（研修マスタで編集 / カテゴリは追加・編集・削除可）
// ─────────────────────────────────────────────
export type OnboardingTemplateItem = {
  key: string;
  name: string;
  dueOffsetDays: number; // 契約開始日からの相対日数（負の値 = 開始前）
  required: boolean;
  defaultAssigneeRole?: "cs" | "pr" | "ops" | "finance";
  /** null/undefined = 全コース共通。文字列 = 特定 courseKey のみ */
  courseKey?: string | null;
};

export type OnboardingCategory = {
  key: string;
  label: string;
  order: number;
  items: OnboardingTemplateItem[];
};

// 指定 courseKey に該当する項目のみを残してテンプレを絞り込む。
// item.courseKey == null は全コース共通として常に残す。
// courseKey が null/undefined なら全コース共通の項目だけ返す。
export function filterTemplateByCourse(
  template: OnboardingCategory[],
  courseKey: string | null | undefined
): OnboardingCategory[] {
  return template
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        if (it.courseKey == null) return true;
        return courseKey != null && it.courseKey === courseKey;
      })
    }))
    .filter((cat) => cat.items.length > 0);
}

// 表示中の契約群（複数 courseKey の混在を許す）に対して、いずれかの契約に
// 該当する項目だけ列として残す。matrix 表示で空列を出さないために使う。
export function filterTemplateByCourses(
  template: OnboardingCategory[],
  courseKeys: ReadonlyArray<string | null | undefined>
): OnboardingCategory[] {
  const set = new Set<string>();
  for (const k of courseKeys) if (k != null) set.add(k);
  return template
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => it.courseKey == null || set.has(it.courseKey))
    }))
    .filter((cat) => cat.items.length > 0);
}

// 4研修のデフォルトオンボテンプレート（設定画面で編集する前提）
export const productOnboardingTemplates: Record<ProductCode, OnboardingCategory[]> = {
  academia: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -30, required: true, defaultAssigneeRole: "cs" },
        { key: "nda", name: "NDA締結", dueOffsetDays: -25, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -20, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -10, required: true, defaultAssigneeRole: "cs" },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -5, required: true, defaultAssigneeRole: "finance" },
        { key: "payment_confirm", name: "入金確認", dueOffsetDays: 30, required: true, defaultAssigneeRole: "finance" }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "LPへの企業ロゴ掲載", dueOffsetDays: -14, required: false, defaultAssigneeRole: "pr" },
        { key: "pr_release", name: "プレスリリース調整", dueOffsetDays: -10, required: false, defaultAssigneeRole: "pr" },
        { key: "sns_post", name: "SNS告知投稿", dueOffsetDays: -3, required: false, defaultAssigneeRole: "pr" }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "venue", name: "開講式会場の予約", dueOffsetDays: -21, required: true, defaultAssigneeRole: "ops" },
        { key: "materials", name: "教材一式の準備", dueOffsetDays: -7, required: true, defaultAssigneeRole: "ops" },
        { key: "lecturer", name: "年間講師のアサイン確定", dueOffsetDays: -14, required: true, defaultAssigneeRole: "ops" },
        { key: "schedule", name: "年間スケジュール確定・共有", dueOffsetDays: -14, required: true, defaultAssigneeRole: "cs" }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "派遣者3名のリスト受領", dueOffsetDays: -21, required: true, defaultAssigneeRole: "cs" },
        { key: "account", name: "参加者アカウント発行", dueOffsetDays: -7, required: true, defaultAssigneeRole: "ops" },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -3, required: true, defaultAssigneeRole: "cs" },
        { key: "pre_survey", name: "事前アンケート配布", dueOffsetDays: -3, required: false, defaultAssigneeRole: "cs" }
      ]
    },
    {
      key: "contract_welcome",
      label: "契約ウェルカム付フェーズ",
      order: 5,
      items: [
        { key: "verbal_approval", name: "企業からの内諾", dueOffsetDays: -90, required: true, defaultAssigneeRole: "cs" },
        { key: "sales_handoff", name: "営業からの引き継ぎ", dueOffsetDays: -85, required: true, defaultAssigneeRole: "cs" },
        { key: "handoff_greeting", name: "引継挨拶", dueOffsetDays: -80, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_info", name: "契約関連情報確認", dueOffsetDays: -75, required: true, defaultAssigneeRole: "cs" },
        { key: "invoice_info", name: "請求関連情報確認", dueOffsetDays: -75, required: true, defaultAssigneeRole: "finance" },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -60, required: true, defaultAssigneeRole: "cs" },
        { key: "contract_signed", name: "契約締結", dueOffsetDays: -45, required: true, defaultAssigneeRole: "cs" },
        { key: "invoice_send", name: "請求書送付", dueOffsetDays: -30, required: true, defaultAssigneeRole: "finance" },
        { key: "payment_confirm", name: "入金確認", dueOffsetDays: -15, required: true, defaultAssigneeRole: "finance" }
      ]
    },
    {
      key: "usage_policy",
      label: "活用方針確定フェーズ",
      order: 6,
      items: [
        { key: "prekickoff_schedule", name: "プレキックオフ日程調整", dueOffsetDays: -45, required: true, defaultAssigneeRole: "cs" },
        { key: "prekickoff_execute", name: "プレキックオフ実施", dueOffsetDays: -30, required: true, defaultAssigneeRole: "cs" },
        { key: "org_chart_decided", name: "企業組織図決定", dueOffsetDays: -25, required: true, defaultAssigneeRole: "cs" },
        { key: "vision_articulation", name: "ビジョンと期待値の言語化", dueOffsetDays: -25, required: true, defaultAssigneeRole: "cs" },
        { key: "participant_finalized", name: "企業選抜生確定", dueOffsetDays: -21, required: true, defaultAssigneeRole: "cs" }
      ]
    },
    {
      key: "participation_prep",
      label: "参加準備フェーズ",
      order: 7,
      items: [
        { key: "kickoff_schedule", name: "キックオフ日程調整", dueOffsetDays: -14, required: true, defaultAssigneeRole: "cs" },
        { key: "kickoff_execute", name: "キックオフ実施", dueOffsetDays: 0, required: true, defaultAssigneeRole: "cs" },
        { key: "pre_training_attendance", name: "事前研修出欠確認", dueOffsetDays: -7, required: true, defaultAssigneeRole: "cs" },
        { key: "slack_login", name: "Slackのログイン", dueOffsetDays: -3, required: true, defaultAssigneeRole: "ops" },
        { key: "portal_login", name: "ポータルログイン", dueOffsetDays: -3, required: true, defaultAssigneeRole: "ops" },
        { key: "kickoff_party_attendance", name: "キックオフパーティ出欠確認", dueOffsetDays: -3, required: true, defaultAssigneeRole: "cs" },
        { key: "first_lecture_attend", name: "第1回講義参加", dueOffsetDays: 7, required: false, defaultAssigneeRole: "cs" }
      ]
    }
  ],

  hyogikai: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -30, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -15, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -7, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "公式サイトへの掲載", dueOffsetDays: -7, required: false },
        { key: "sns_post", name: "SNS告知", dueOffsetDays: -3, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "運営準備",
      order: 3,
      items: [
        { key: "theme_plan", name: "年間テーマプラン共有", dueOffsetDays: -14, required: true },
        { key: "venue", name: "定例会会場の確保", dueOffsetDays: -21, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "regular_members", name: "固定メンバー確定", dueOffsetDays: -14, required: true },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -3, required: true }
      ]
    }
  ],

  aiken: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "申込内容の記録", dueOffsetDays: -14, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -10, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -5, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true },
        { key: "payment_confirm", name: "入金確認", dueOffsetDays: 0, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "受講企業ロゴ掲載", dueOffsetDays: -5, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "venue", name: "Day1/Day2 会場確保", dueOffsetDays: -7, required: true },
        { key: "materials", name: "教材配布", dueOffsetDays: -3, required: true },
        { key: "lecturer_brief", name: "講師との事前打合せ", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "受講者リスト受領", dueOffsetDays: -7, required: true },
        { key: "account", name: "受講者アカウント発行", dueOffsetDays: -3, required: true },
        { key: "welcome_mail", name: "ウェルカムメール配信", dueOffsetDays: -2, required: true }
      ]
    }
  ],

  commu: [
    {
      key: "contract",
      label: "契約系",
      order: 1,
      items: [
        { key: "verbal_record", name: "内諾内容の記録", dueOffsetDays: -14, required: true },
        { key: "contract_send", name: "契約書送付", dueOffsetDays: -10, required: true },
        { key: "contract_return", name: "契約書回収", dueOffsetDays: -5, required: true },
        { key: "invoice", name: "請求書発行", dueOffsetDays: -3, required: true }
      ]
    },
    {
      key: "pr",
      label: "広報系",
      order: 2,
      items: [
        { key: "lp_listing", name: "LP企業ロゴ掲載", dueOffsetDays: -7, required: false }
      ]
    },
    {
      key: "course_setup",
      label: "講座設定系",
      order: 3,
      items: [
        { key: "schedule", name: "3ヶ月スケジュール確定", dueOffsetDays: -10, required: true },
        { key: "materials", name: "教材準備", dueOffsetDays: -5, required: true }
      ]
    },
    {
      key: "participant",
      label: "参加者登録系",
      order: 4,
      items: [
        { key: "participant_list", name: "受講者リスト受領", dueOffsetDays: -7, required: true },
        { key: "account", name: "受講者アカウント発行", dueOffsetDays: -3, required: true },
        { key: "kickoff_invite", name: "Kickoff招待状配信", dueOffsetDays: -3, required: true }
      ]
    }
  ]
};

// ─────────────────────────────────────────────
// カスタマージャーニー（契約開始後の運用フェーズ）
// ─────────────────────────────────────────────
export type JourneyPhase = {
  key: string;
  label: string;
  description?: string;
  order: number;
};

export const productJourney: Record<ProductCode, JourneyPhase[]> = {
  academia: [
    { key: "intro", label: "導入", description: "Kickoff〜開講直後", order: 1 },
    { key: "q1", label: "前期", description: "第1〜第10回", order: 2 },
    { key: "mid", label: "中間評価", description: "中間発表・個別面談", order: 3 },
    { key: "q2", label: "後期", description: "第11〜第21回", order: 4 },
    { key: "graduate", label: "修了", description: "最終発表・修了式", order: 5 }
  ],
  hyogikai: [
    { key: "intro", label: "導入", description: "初回〜第2回", order: 1 },
    { key: "running", label: "運用中", description: "第3〜第9回", order: 2 },
    { key: "closing", label: "総括", description: "第10回・総括レポート", order: 3 }
  ],
  aiken: [
    { key: "trial", label: "体験", description: "初回コース受講", order: 1 },
    { key: "continue", label: "継続", description: "再受講・応用コース", order: 2 },
    { key: "expand", label: "拡大", description: "複数コース並行・社内展開", order: 3 }
  ],
  commu: [
    { key: "intro", label: "導入", description: "Kickoff〜第1回", order: 1 },
    { key: "running", label: "運用", description: "第2〜第4回", order: 2 },
    { key: "renewal", label: "更新判断", description: "最終回〜継続意向確認", order: 3 }
  ]
};

// Contract への移行期間中の後方互換エイリアス
export type ActiveContract = Contract;
