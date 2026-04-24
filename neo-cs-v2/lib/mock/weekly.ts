// 週次レビュー (企業 × 研修) のデータモデル
// CS週次運用: 実施事項 / Good / More / 来週やること
// Carry-over: 先週のNextが今週の実施事項候補として持ち越される

import { ProductCode } from "./data";

export type WeeklyAction = {
  id: string;
  text: string;
  done: boolean;
  fromPrevWeek?: boolean; // 先週のNextから持ち越し
  carriedFromWeek?: string; // 何週前から持ち越されているか (stuck検知用)
  assigneeName?: string;
  completedAt?: string;
};

export type WeeklyNextAction = {
  id: string;
  text: string;
  assigneeName: string;
  dueDate?: string;
};

export type WeeklyReview = {
  id: string;
  companyId: string;
  product: ProductCode;
  weekStart: string; // 月曜 (YYYY-MM-DD)
  weekEnd: string;   // 日曜
  weekLabel: string; // "W17" etc.
  actions: WeeklyAction[];
  good: string;
  more: string;
  nextActions: WeeklyNextAction[];
  authorName: string;
  locked: boolean; // 週ロック（過去週はtrue）
  updatedAt: string;
};

// 週番号 → 日付範囲ヘルパー
// 今日を 2026-04-24 (金) とする。月曜起点の週番号 W = ISO週+何か
// シンプルに: 月曜基点、2026-04-20 を W17 とする

export function getWeekRange(weekStart: string): { start: string; end: string; label: string } {
  const d = new Date(weekStart);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  // W番号は2026-01-05(W01) を基準
  const baseMonday = new Date("2026-01-05");
  const diffDays = Math.floor(
    (d.getTime() - baseMonday.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weekNo = Math.floor(diffDays / 7) + 1;
  return {
    start: weekStart,
    end: end.toISOString().slice(0, 10),
    label: `W${String(weekNo).padStart(2, "0")}`
  };
}

export function formatWeekRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(s.getMonth() + 1)}/${pad(s.getDate())}〜${pad(e.getMonth() + 1)}/${pad(e.getDate())}`;
}

// 月曜日を日付から計算
export function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=日 1=月..6=土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// 前の週の月曜
export function prevWeek(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// 次の週の月曜
export function nextWeekDate(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// 今日の月曜 (2026-04-24 は金曜 → 月曜は 2026-04-20)
export const TODAY_STR = "2026-04-24";
export const CURRENT_WEEK_MONDAY = getMondayOf(TODAY_STR); // "2026-04-20"

// ─────────────────────────────────────────────
// ダミーデータ生成: いくつかの (企業×研修) ペアで過去4〜5週分
// ─────────────────────────────────────────────

function makeReview(
  companyId: string,
  product: ProductCode,
  weeksAgo: number,
  data: {
    actions?: WeeklyAction[];
    good?: string;
    more?: string;
    nextActions?: WeeklyNextAction[];
    authorName?: string;
  }
): WeeklyReview {
  const monday = new Date(CURRENT_WEEK_MONDAY);
  monday.setDate(monday.getDate() - weeksAgo * 7);
  const mondayStr = monday.toISOString().slice(0, 10);
  const range = getWeekRange(mondayStr);
  return {
    id: `w-${companyId}-${product}-${mondayStr}`,
    companyId,
    product,
    weekStart: range.start,
    weekEnd: range.end,
    weekLabel: range.label,
    actions: data.actions ?? [],
    good: data.good ?? "",
    more: data.more ?? "",
    nextActions: data.nextActions ?? [],
    authorName: data.authorName ?? "古野",
    locked: weeksAgo > 0,
    updatedAt: `${range.end}T18:00:00`
  };
}

export const weeklyReviews: WeeklyReview[] = [
  // イオン九州 × ACADEMIA (直近5週)
  makeReview("c-aeon", "academia", 4, {
    actions: [
      { id: "a1", text: "第13回講義の受講サポート（佐藤課長欠席のフォローアップ）", done: true, assigneeName: "古野", completedAt: "2026-03-24" },
      { id: "a2", text: "田中部長へ中間評価会の日程候補を送付", done: true, assigneeName: "古野", completedAt: "2026-03-26" }
    ],
    good: "欠席フォローがスムーズにできた。田中部長からは「進捗に満足」とコメント。",
    more: "佐藤課長の出席率が下がっている。本人・上長へのヒアリング必要。",
    nextActions: [
      { id: "n1", text: "佐藤課長の稼働状況をヒアリング", assigneeName: "古野", dueDate: "2026-04-02" },
      { id: "n2", text: "中間評価会の正式日程確定", assigneeName: "古野", dueDate: "2026-04-03" }
    ],
    authorName: "古野"
  }),
  makeReview("c-aeon", "academia", 3, {
    actions: [
      { id: "a1", text: "佐藤課長の稼働状況をヒアリング", done: true, fromPrevWeek: true, carriedFromWeek: "W13", assigneeName: "古野", completedAt: "2026-03-31" },
      { id: "a2", text: "中間評価会の正式日程確定", done: true, fromPrevWeek: true, carriedFromWeek: "W13", assigneeName: "古野", completedAt: "2026-04-03" },
      { id: "a3", text: "副社長へ事業進捗レポート提出", done: true, assigneeName: "古野", completedAt: "2026-04-04" }
    ],
    good: "佐藤課長から「代替要員の検討を社内で進める」と前向きな返答。副社長も取り組みを高く評価。",
    more: "代替要員が見つからない場合の対応案を事前にNEO側で準備しておくべき。",
    nextActions: [
      { id: "n1", text: "代替要員案の叩き台を用意", assigneeName: "古野", dueDate: "2026-04-10" },
      { id: "n2", text: "中間評価会の資料作成", assigneeName: "古野", dueDate: "2026-04-12" }
    ],
    authorName: "古野"
  }),
  makeReview("c-aeon", "academia", 2, {
    actions: [
      { id: "a1", text: "代替要員案の叩き台を用意", done: true, fromPrevWeek: true, carriedFromWeek: "W14", assigneeName: "古野", completedAt: "2026-04-07" },
      { id: "a2", text: "中間評価会の資料作成", done: true, fromPrevWeek: true, carriedFromWeek: "W14", assigneeName: "古野", completedAt: "2026-04-10" },
      { id: "a3", text: "第14回講義の運営", done: true, assigneeName: "古野", completedAt: "2026-04-09" }
    ],
    good: "中間評価会の資料に対して副社長から「論点が明確」と評価。",
    more: "代替要員の人選がまだ固まらない。早めに候補を提示して議論を進める必要がある。",
    nextActions: [
      { id: "n1", text: "代替要員候補リストの最終版を提出", assigneeName: "古野", dueDate: "2026-04-17" },
      { id: "n2", text: "中間評価会の参加者調整", assigneeName: "三木", dueDate: "2026-04-18" }
    ],
    authorName: "古野"
  }),
  makeReview("c-aeon", "academia", 1, {
    actions: [
      { id: "a1", text: "代替要員候補リストの最終版を提出", done: false, fromPrevWeek: true, carriedFromWeek: "W15", assigneeName: "古野" },
      { id: "a2", text: "中間評価会の参加者調整", done: true, fromPrevWeek: true, carriedFromWeek: "W15", assigneeName: "三木", completedAt: "2026-04-18" },
      { id: "a3", text: "田中部長との四半期レビューMTG実施", done: true, assigneeName: "古野", completedAt: "2026-04-15" }
    ],
    good: "四半期レビューで継続意欲を明確に再確認。副社長にもレポート済み。",
    more: "代替要員候補の人選が社内政治的に難航。人事部だけでは決められないことが判明。担当役員を巻き込む必要あり。",
    nextActions: [
      { id: "n1", text: "山田副社長への代替要員案の打診", assigneeName: "古野", dueDate: "2026-04-24" },
      { id: "n2", text: "第15回講義の資料を事前送付", assigneeName: "古野", dueDate: "2026-04-22" },
      { id: "n3", text: "更新契約の条件ドラフト作成", assigneeName: "古野", dueDate: "2026-04-25" }
    ],
    authorName: "古野"
  }),
  // 今週 (W17) は未入力 (=作成されていない)

  // イオン九州 × 評議会 (直近3週)
  makeReview("c-aeon", "hyogikai", 3, {
    actions: [
      { id: "a1", text: "第4回定例会の準備・実施", done: true, assigneeName: "三木", completedAt: "2026-04-02" }
    ],
    good: "副社長（ゲスト）が2回連続出席。企業としての評議会への期待値が高い。",
    more: "テーマが抽象的との意見。より具体的なケーススタディを増やしたい。",
    nextActions: [
      { id: "n1", text: "次回テーマを「地域経済」に具体化、事例を準備", assigneeName: "三木", dueDate: "2026-04-10" }
    ],
    authorName: "三木"
  }),
  makeReview("c-aeon", "hyogikai", 2, {
    actions: [
      { id: "a1", text: "次回テーマを「地域経済」に具体化、事例を準備", done: true, fromPrevWeek: true, carriedFromWeek: "W14", assigneeName: "三木", completedAt: "2026-04-10" }
    ],
    good: "ケーススタディの事例が提案段階で好評。",
    more: "",
    nextActions: [
      { id: "n1", text: "第5回定例会の実施", assigneeName: "三木", dueDate: "2026-04-18" }
    ],
    authorName: "三木"
  }),
  makeReview("c-aeon", "hyogikai", 1, {
    actions: [
      { id: "a1", text: "第5回定例会の実施", done: true, fromPrevWeek: true, carriedFromWeek: "W15", assigneeName: "三木", completedAt: "2026-04-17" }
    ],
    good: "田中部長・山田副社長ともに積極発言。テーマ変更が奏功。",
    more: "",
    nextActions: [
      { id: "n1", text: "第6回のアジェンダ案を5月上旬に提案", assigneeName: "三木", dueDate: "2026-05-07" }
    ],
    authorName: "三木"
  }),

  // 西日本鉄道 × 評議会 (危険信号: nextが複数週持ち越し)
  makeReview("c-nishitetsu", "hyogikai", 3, {
    actions: [
      { id: "a1", text: "担当役員へ欠席理由のヒアリング", done: false, assigneeName: "三木" }
    ],
    good: "",
    more: "担当役員が多忙で返答なし。接点がほぼ消失している。",
    nextActions: [
      { id: "n1", text: "担当役員へ欠席理由のヒアリング（別ルートで）", assigneeName: "三木", dueDate: "2026-04-10" }
    ],
    authorName: "三木"
  }),
  makeReview("c-nishitetsu", "hyogikai", 2, {
    actions: [
      { id: "a1", text: "担当役員へ欠席理由のヒアリング（別ルートで）", done: false, fromPrevWeek: true, carriedFromWeek: "W13", assigneeName: "三木" }
    ],
    good: "",
    more: "依然として返信なし。2週連続で持ち越し。別の接点を探す必要がある。",
    nextActions: [
      { id: "n1", text: "役員の秘書経由でアポ依頼", assigneeName: "三木", dueDate: "2026-04-17" }
    ],
    authorName: "三木"
  }),
  makeReview("c-nishitetsu", "hyogikai", 1, {
    actions: [
      { id: "a1", text: "役員の秘書経由でアポ依頼", done: false, fromPrevWeek: true, carriedFromWeek: "W15", assigneeName: "三木" }
    ],
    good: "",
    more: "秘書経由でも連絡がつかない状況。契約終了に向けた対応策を検討すべきかもしれない。",
    nextActions: [
      { id: "n1", text: "三木より代表電話経由で役員へ直接連絡", assigneeName: "三木", dueDate: "2026-04-24" },
      { id: "n2", text: "契約終了を前提とした社内共有資料の準備", assigneeName: "三木", dueDate: "2026-04-28" }
    ],
    authorName: "三木"
  }),

  // 福岡銀行 × コミュマネ (オンボ中)
  makeReview("c-fukugin", "commu", 1, {
    actions: [
      { id: "a1", text: "契約書送付（オンボ項目）", done: false, assigneeName: "古野" },
      { id: "a2", text: "参加者リスト受領依頼", done: false, assigneeName: "古野" }
    ],
    good: "担当者は前向き。参加者リストも来週には揃う見込み。",
    more: "契約書の回答が遅い。法務チェックが長引いている様子。",
    nextActions: [
      { id: "n1", text: "契約書送付のリマインド連絡", assigneeName: "古野", dueDate: "2026-04-24" },
      { id: "n2", text: "Kickoff日程の再調整提案", assigneeName: "古野", dueDate: "2026-04-25" }
    ],
    authorName: "古野"
  })
];

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

// ある(企業×研修)の週次レビューを週古い順で取得
export function getReviewsForCompanyProduct(companyId: string, product: ProductCode): WeeklyReview[] {
  return weeklyReviews
    .filter((r) => r.companyId === companyId && r.product === product)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// 企業の契約研修一覧（ユニーク）
export function getCompanyReviewProducts(
  companyId: string,
  contracts: { companyId: string; product: ProductCode }[]
): ProductCode[] {
  return Array.from(
    new Set(contracts.filter((c) => c.companyId === companyId).map((c) => c.product))
  );
}

// stuck検知: 何週前から持ち越されているか
export function weeksStuck(fromWeekLabel: string, currentWeekLabel: string): number {
  const m = fromWeekLabel.match(/W(\d+)/);
  const c = currentWeekLabel.match(/W(\d+)/);
  if (!m || !c) return 0;
  return parseInt(c[1]) - parseInt(m[1]);
}
