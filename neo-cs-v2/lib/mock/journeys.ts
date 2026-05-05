// 企業ジャーニー / 事業ジャーニー の型・既定ステージ定義・seed データ
//
// 設計:
//   - 企業ジャーニー (company journey): 会社単位・永続。NEOへの関与度を表現
//   - 事業ジャーニー (business journey): 契約 (商材×期) 単位。契約更新+アップセルへの進捗
//   - ステージ定義は organization 単位でカスタム可能 (journey_stage_definitions)
//   - 後退時 (display_order が下がる遷移) はUI側で警告を出す

export type JourneyType = "company" | "business";

export type JourneyStageDefinition = {
  id: string;
  organizationId: string;
  journeyType: JourneyType;
  /** 組織内で安定した識別子 (UI 並び替えの key にも使う) */
  stageKey: string;
  /** 表示順 (1 始まり)。後退判定の基準 */
  displayOrder: number;
  name: string;
  description: string;
  /** Tailwind hex / rgb 等任意。未設定時はデフォルト色 */
  color?: string;
  /** 担当が手動で更新する際のヒント・キーアクション */
  keyActions?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyJourney = {
  companyId: string;
  organizationId: string;
  currentStageKey: string;
  stageEnteredAt: string;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type BusinessJourney = {
  contractId: string;
  organizationId: string;
  currentStageKey: string;
  stageEnteredAt: string;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type JourneyEvent = {
  id: string;
  organizationId: string;
  /** company の場合は companyId / business の場合は contractId */
  subjectId: string;
  journeyType: JourneyType;
  fromStageKey?: string;
  toStageKey: string;
  changedAt: string;
  changedBy?: string;
  /** 後退時に必須 (UI 側で必須化) */
  note?: string;
  /** 後退として記録された遷移か (audit 表示用) */
  isRegression?: boolean;
};

// ─────────────────────────────────────────────
// 既定ステージ (seed) — 企業ジャーニー 7段階
// ─────────────────────────────────────────────
export const DEFAULT_COMPANY_STAGES: Array<
  Pick<JourneyStageDefinition, "stageKey" | "displayOrder" | "name" | "description" | "color" | "keyActions">
> = [
  {
    stageKey: "interest",
    displayOrder: 1,
    name: "1. 興味喚起 (ワクワク)",
    description: "「NEOって面白そう」と思っているが、実態はよくわかっていない",
    color: "#A78B6F",
    keyActions: "事例共有・動画・オープニングイベント参加で共感形成"
  },
  {
    stageKey: "first_touch",
    displayOrder: 2,
    name: "2. 接触・初体験",
    description: "イベント/Slack/学生交流などを一部体験している",
    color: "#B98A6B",
    keyActions: "イベント招待、ライトな参加体験、共感発見"
  },
  {
    stageKey: "value_perception",
    displayOrder: 3,
    name: "3. 価値の仮理解",
    description: "「他と違う」「可能性がある」と感じている",
    color: "#A8744E",
    keyActions: "他社の活用例・成果事例をストーリーで共有"
  },
  {
    stageKey: "small_win",
    displayOrder: 4,
    name: "4. 小さな成功体験",
    description: "学生連携や他企業交流で社内にポジティブな話題が出ている",
    color: "#C9742A",
    keyActions: "成果の言語化サポート、社内向けフィードバック共有"
  },
  {
    stageKey: "internal_spread",
    displayOrder: 5,
    name: "5. 社内浸透",
    description: "上司・現場・役員レベルにNEOの認知が広がっている",
    color: "#5C7AB6",
    keyActions: "報告資料テンプレート、1分ピッチ資料の提供"
  },
  {
    stageKey: "investment_view",
    displayOrder: 6,
    name: "6. 投資対象としてのNEO",
    description: "中長期の人材育成・事業共創・ブランド価値向上に貢献すると社内で認識",
    color: "#7E5BAE",
    keyActions: "拡張提案 (NEO ACADEMIA協業、共創、他地域展開)"
  },
  {
    stageKey: "partner",
    displayOrder: 7,
    name: "7. パートナー化",
    description: "共創パートナー・中核応援企業として自認している",
    color: "#9C7FB8",
    keyActions: "パートナー契約、新たな活用戦略会議、共同発信"
  }
];

// ─────────────────────────────────────────────
// 既定ステージ (seed) — 事業ジャーニー 9段階
// ─────────────────────────────────────────────
export const DEFAULT_BUSINESS_STAGES: Array<
  Pick<JourneyStageDefinition, "stageKey" | "displayOrder" | "name" | "description" | "color" | "keyActions">
> = [
  {
    stageKey: "kickoff",
    displayOrder: 1,
    name: "1. 立ち上げ・オンボーディング",
    description: "契約直後、初期セットアップ・キックオフ実施中",
    keyActions: "オンボードタスク完了、初回MTG、関係者把握"
  },
  {
    stageKey: "running",
    displayOrder: 2,
    name: "2. 運用・初期成果",
    description: "学生連携や交流が動き出し、初期の手応えが見え始めている",
    keyActions: "出席率・参加状況の可視化、初期FB回収"
  },
  {
    stageKey: "value_articulated",
    displayOrder: 3,
    name: "3. 成果の言語化",
    description: "事業側で使えるイメージが具体化、社内で共有可能な状態",
    keyActions: "Success Plan 達成度レビュー、事例ライティング"
  },
  {
    stageKey: "renewal_consideration",
    displayOrder: 4,
    name: "4. 継続価値検討",
    description: "来期の関わり方を検討開始 (T-120 〜 T-90)",
    keyActions: "第二回面談、価値実現レビュー、更新意向ヒアリング"
  },
  {
    stageKey: "internal_share",
    displayOrder: 5,
    name: "5. 社内共有・方針固め",
    description: "次期プランを社内に共有し、方針を固める段階",
    keyActions: "次期プラン提示、社内向け報告資料の作成サポート"
  },
  {
    stageKey: "approval_prep",
    displayOrder: 6,
    name: "6. 稟議・承認準備",
    description: "稟議に必要な資料・ストーリーを準備中 (T-60)",
    keyActions: "役員サマリー資料、企業名入り成果報告書の提供"
  },
  {
    stageKey: "contract_negotiation",
    displayOrder: 7,
    name: "7. 契約手続き",
    description: "契約内容のやり取り・調整中 (T-30)",
    keyActions: "契約書送付、条件調整、最終合意"
  },
  {
    stageKey: "renewed",
    displayOrder: 8,
    name: "8. 契約締結",
    description: "社内決裁が下り、来期の継続が決定",
    keyActions: "感謝・次期計画提示、アップセルの提案機会"
  },
  {
    stageKey: "upsell",
    displayOrder: 9,
    name: "9. アップセル快諾",
    description: "金額・関与領域の拡大に合意、共創パートナーとして自認",
    keyActions: "パートナー契約締結、戦略会議、共同発信"
  }
];

// ─────────────────────────────────────────────
// Seed: mock 環境用の初期 Journey データ
// ─────────────────────────────────────────────
const NOW = "2026-04-24T00:00:00.000Z";

export const seedCompanyJourneys: Omit<CompanyJourney, "organizationId">[] = [
  {
    companyId: "c-aeon",
    currentStageKey: "investment_view",
    stageEnteredAt: "2025-12-01",
    note: "副社長レベルでの投資判断会話に進出",
    updatedAt: NOW
  },
  {
    companyId: "c-jrq",
    currentStageKey: "internal_spread",
    stageEnteredAt: "2025-09-15",
    updatedAt: NOW
  },
  {
    companyId: "c-kyudenko",
    currentStageKey: "small_win",
    stageEnteredAt: "2025-12-01",
    updatedAt: NOW
  }
];

export const seedBusinessJourneys: Omit<BusinessJourney, "organizationId">[] = [
  {
    contractId: "k-aeon-academia",
    currentStageKey: "value_articulated",
    stageEnteredAt: "2026-02-01",
    updatedAt: NOW
  },
  {
    contractId: "k-aeon-hyogikai",
    currentStageKey: "running",
    stageEnteredAt: "2025-10-01",
    updatedAt: NOW
  },
  {
    contractId: "k-kyudenko-commu",
    currentStageKey: "renewal_consideration",
    stageEnteredAt: "2026-03-15",
    note: "T-120 を通過。価値実現レビュー実施済み",
    updatedAt: NOW
  }
];
