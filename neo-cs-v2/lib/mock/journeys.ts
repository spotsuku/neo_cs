// 企業ジャーニー / 事業ジャーニー の型・既定ステージ定義・seed データ
//
// 設計:
//   - 企業ジャーニー (company journey): 会社単位・永続。NEOへの関与度を表現
//   - 事業ジャーニー (business journey): 契約 (商材×期) 単位。契約更新+アップセルへの進捗
//   - ステージ定義は organization 単位でカスタム可能 (journey_stage_definitions)
//   - 後退時 (display_order が下がる遷移) はUI側で警告を出す

export type JourneyType = "company" | "business";

/**
 * ステージ完了の目安となるチェック項目（2〜3個）
 * UI: ステージカード内にチェックボックス表示。完了状況は journey_checkpoint_status 側で保持
 */
export type JourneyCheckpoint = {
  /** ステージ内で安定したキー */
  key: string;
  label: string;
  description?: string;
};

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
  /** 担当が手動で更新する際のヒント・キーアクション (旧形式・後方互換) */
  keyActions?: string;
  /** ステージ完了の目安となるチェック項目 (2〜3個) */
  checkpoints?: JourneyCheckpoint[];
  createdAt: string;
  updatedAt: string;
};

/**
 * 事業ジャーニーの「解約軸」
 * progress_stage (1〜9) とは別軸。途中ステージで解約することがあるため、
 * フラットなステージ拡張ではなく独立した状態として保持する。
 *  - active     : 通常進行
 *  - at_risk    : 解約検討中（救済可能。active 復帰あり）
 *  - churned    : 解約決定（終端）
 *  - re_approach: 解約後の再アプローチ計画中
 */
export type BusinessLifecycleState = "active" | "at_risk" | "churned" | "re_approach";

export const LIFECYCLE_STATE_LABEL: Record<BusinessLifecycleState, string> = {
  active: "通常進行",
  at_risk: "解約検討",
  churned: "解約決定",
  re_approach: "再アプローチ計画"
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
  /** 解約軸の状態 (default: active) */
  lifecycleState?: BusinessLifecycleState;
  /** 解約 / 再アプローチに移行した時の理由（churn_records と二重持ちでも可） */
  lifecycleReason?: string;
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
  Pick<JourneyStageDefinition, "stageKey" | "displayOrder" | "name" | "description" | "color" | "keyActions" | "checkpoints">
> = [
  {
    stageKey: "interest",
    displayOrder: 1,
    name: "1. 興味喚起 (ワクワク)",
    description: "「NEOって面白そう」と思っているが、実態はよくわかっていない",
    color: "#A78B6F",
    keyActions: "事例共有・動画・オープニングイベント参加で共感形成",
    checkpoints: [
      { key: "case_shared", label: "成功事例を共有した" },
      { key: "event_invited", label: "オープニングイベントへ招待した" }
    ]
  },
  {
    stageKey: "first_touch",
    displayOrder: 2,
    name: "2. 接触・初体験",
    description: "イベント/Slack/学生交流などを一部体験している",
    color: "#B98A6B",
    keyActions: "イベント招待、ライトな参加体験、共感発見",
    checkpoints: [
      { key: "event_attended", label: "イベントに参加した" },
      { key: "slack_joined", label: "Slack 等のコミュニティに参加した" }
    ]
  },
  {
    stageKey: "value_perception",
    displayOrder: 3,
    name: "3. 価値の仮理解",
    description: "「他と違う」「可能性がある」と感じている",
    color: "#A8744E",
    keyActions: "他社の活用例・成果事例をストーリーで共有",
    checkpoints: [
      { key: "peer_case_shared", label: "同業他社の活用事例を共有した" },
      { key: "value_dialogue", label: "価値・期待効果について対話した" }
    ]
  },
  {
    stageKey: "small_win",
    displayOrder: 4,
    name: "4. 小さな成功体験",
    description: "学生連携や他企業交流で社内にポジティブな話題が出ている",
    color: "#C9742A",
    keyActions: "成果の言語化サポート、社内向けフィードバック共有",
    checkpoints: [
      { key: "win_articulated", label: "初期成果を言語化した" },
      { key: "internal_feedback", label: "社内ポジティブFB を回収した" }
    ]
  },
  {
    stageKey: "internal_spread",
    displayOrder: 5,
    name: "5. 社内浸透",
    description: "上司・現場・役員レベルにNEOの認知が広がっている",
    color: "#5C7AB6",
    keyActions: "報告資料テンプレート、1分ピッチ資料の提供",
    checkpoints: [
      { key: "report_template_provided", label: "社内報告テンプレを提供した" },
      { key: "exec_briefed", label: "役員レベルに NEO の認知を広げた" }
    ]
  },
  {
    stageKey: "investment_view",
    displayOrder: 6,
    name: "6. 投資対象としてのNEO",
    description: "中長期の人材育成・事業共創・ブランド価値向上に貢献すると社内で認識",
    color: "#7E5BAE",
    keyActions: "拡張提案 (NEO ACADEMIA協業、共創、他地域展開)",
    checkpoints: [
      { key: "expansion_proposed", label: "拡張提案を提示した" },
      { key: "long_term_dialogue", label: "中長期視点での対話を行った" },
      { key: "exec_alignment", label: "役員レベルで投資価値の合意を得た" }
    ]
  },
  {
    stageKey: "partner",
    displayOrder: 7,
    name: "7. パートナー化",
    description: "共創パートナー・中核応援企業として自認している",
    color: "#9C7FB8",
    keyActions: "パートナー契約、新たな活用戦略会議、共同発信",
    checkpoints: [
      { key: "partner_agreement", label: "パートナー契約を締結した" },
      { key: "joint_strategy_meeting", label: "戦略会議に共同参加した" },
      { key: "co_communication", label: "共同発信 (PR・登壇等) を行った" }
    ]
  }
];

// ─────────────────────────────────────────────
// 既定ステージ (seed) — 事業ジャーニー 9段階
//   ステージ8「内諾」時点で次期のオンボードが始まる前提
//   解約は lifecycleState (active/at_risk/churned/re_approach) 軸で別管理
// ─────────────────────────────────────────────
export const DEFAULT_BUSINESS_STAGES: Array<
  Pick<JourneyStageDefinition, "stageKey" | "displayOrder" | "name" | "description" | "color" | "keyActions" | "checkpoints">
> = [
  {
    stageKey: "kickoff",
    displayOrder: 1,
    name: "1. 立ち上げ・オンボーディング",
    description: "契約直後、初期セットアップ・キックオフ実施中",
    keyActions: "オンボードタスク完了、初回MTG、関係者把握",
    checkpoints: [
      { key: "kickoff_done", label: "キックオフMTGを実施した" },
      { key: "stakeholders_mapped", label: "関係者マップを作成した" },
      { key: "onboarding_started", label: "オンボードタスクを開始した" }
    ]
  },
  {
    stageKey: "running",
    displayOrder: 2,
    name: "2. 運用・初期成果",
    description: "学生連携や交流が動き出し、初期の手応えが見え始めている",
    keyActions: "出席率・参加状況の可視化、初期FB回収",
    checkpoints: [
      { key: "attendance_tracked", label: "出席率の可視化を始めた" },
      { key: "early_feedback", label: "初期フィードバックを回収した" }
    ]
  },
  {
    stageKey: "value_articulated",
    displayOrder: 3,
    name: "3. 成果の言語化",
    description: "事業側で使えるイメージが具体化、社内で共有可能な状態",
    keyActions: "Success Plan 達成度レビュー、事例ライティング",
    checkpoints: [
      { key: "success_plan_reviewed", label: "Success Plan の達成度をレビューした" },
      { key: "case_written", label: "成功事例を文書化した" }
    ]
  },
  {
    stageKey: "renewal_consideration",
    displayOrder: 4,
    name: "4. 継続価値検討",
    description: "来期の関わり方を検討開始",
    keyActions: "第二回面談、価値実現レビュー、更新意向ヒアリング",
    checkpoints: [
      { key: "second_meeting", label: "第二回面談を実施した" },
      { key: "value_review", label: "価値実現レビューを完了した" },
      { key: "intent_hearing", label: "更新意向のヒアリングを行った" }
    ]
  },
  {
    stageKey: "internal_share",
    displayOrder: 5,
    name: "5. 社内共有・方針固め",
    description: "次期プランを社内に共有し、方針を固める段階",
    keyActions: "次期プラン提示、社内向け報告資料の作成サポート",
    checkpoints: [
      { key: "next_plan_proposed", label: "次期プランを提示した" },
      { key: "internal_report_supported", label: "社内向け報告資料の作成をサポートした" }
    ]
  },
  {
    stageKey: "approval_prep",
    displayOrder: 6,
    name: "6. 稟議・承認準備",
    description: "稟議に必要な資料・ストーリーを準備中",
    keyActions: "役員サマリー資料、企業名入り成果報告書の提供",
    checkpoints: [
      { key: "exec_summary_provided", label: "役員サマリーを提供した" },
      { key: "approval_doc_ready", label: "稟議資料が揃った" }
    ]
  },
  {
    stageKey: "verbal_consent",
    displayOrder: 7,
    name: "7. 口頭内諾",
    description: "決裁者から口頭での前向きな返答を得た段階",
    keyActions: "条件確認、次期スコープのすり合わせ",
    checkpoints: [
      { key: "verbal_ok", label: "口頭で前向きな返答を得た" },
      { key: "scope_aligned", label: "次期スコープのすり合わせを完了した" }
    ]
  },
  {
    stageKey: "consent",
    displayOrder: 8,
    name: "8. 内諾",
    description: "正式な内諾を得た段階。次期オンボードを開始",
    keyActions: "次期オンボード起票、次期Success Plan着手、次期キックオフ準備",
    checkpoints: [
      { key: "next_term_created", label: "次期契約を起票した" },
      { key: "next_onboarding_started", label: "次期オンボードを開始した" },
      { key: "next_success_plan", label: "次期 Success Plan を着手した" }
    ]
  },
  {
    stageKey: "upsell",
    displayOrder: 9,
    name: "9. アップセル",
    description: "金額・関与領域の拡大に合意、共創パートナーとして自認",
    keyActions: "コース拡張・伴走支援追加・他事業導入の提案",
    checkpoints: [
      { key: "upsell_agreed", label: "アップセル提案に合意した" },
      { key: "additional_scope", label: "追加スコープ (伴走/他事業) を確定した" }
    ]
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

// ─────────────────────────────────────────────
// チェックポイント完了状態
//   journey_checkpoint_status テーブルに対応
//   - 企業ジャーニー: subjectId = companyId
//   - 事業ジャーニー: subjectId = contractId
// ─────────────────────────────────────────────
export type JourneyCheckpointStatus = {
  organizationId: string;
  journeyType: JourneyType;
  subjectId: string;
  stageKey: string;
  checkpointKey: string;
  done: boolean;
  completedAt?: string;
  completedBy?: string;
  note?: string;
};

// ─────────────────────────────────────────────
// 契約終了スナップショット
//   解約・更新成功・期満了時に「凍結」される。
//   企業カルテの過去契約履歴で参照され、後続の編集では値が変わらない。
// ─────────────────────────────────────────────
export type ContractLifecycleSnapshot = {
  contractId: string;
  organizationId: string;
  /** 終了種別 */
  endedAs: "renewed" | "churned" | "expired";
  endedAt: string; // ISO
  /** 終了時の事業ジャーニー最終ステージ */
  finalStageKey: string;
  /** 最終 lifecycleState */
  finalLifecycleState: BusinessLifecycleState;
  /** 出席率(0..1)・チェックポイント進捗・最終 health 等のサマリ */
  metrics: {
    attendanceRate?: number;
    checkpointDoneRatio?: number;
    healthColor?: "green" | "yellow" | "red";
    finalMrr?: number;
  };
  /** 解約理由（churned の場合） */
  churnReason?: string;
  /** 後継契約への参照（renewed の場合） */
  succeededByContractId?: string;
  /** スナップショット時点での全チェックポイント完了状況 (JSON) */
  checkpointStatusSnapshot?: JourneyCheckpointStatus[];
  createdAt: string;
};

// 解約決定 / 更新成功時に lifecycleState から派生
export const FINAL_LIFECYCLE_STATES: BusinessLifecycleState[] = ["churned"];
