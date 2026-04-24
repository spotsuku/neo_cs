// スケール用の追加ダミーデータ（企業 + 契約を多数生成）
// CS運用の見栄え確認用: 研修ごとのコース分布、一覧表ビュー、スクロール感などの検証

import { ProductCode } from "./data";
import type { Company } from "./entities";
import type { ActiveContract } from "./onboarding";

// ─────────────────────────────────────────────
// 追加企業（48社、plausibleな九州企業名）
// 既存12社と合わせて計60社
// ─────────────────────────────────────────────
export const extraCompanies: Company[] = [
  { id: "c-g01", name: "株式会社ジャパネットホールディングス", kana: "じゃぱねっと", industry: "通販", address: "長崎県佐世保市", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 7 },
  { id: "c-g02", name: "株式会社トライアルホールディングス", kana: "とらいある", industry: "小売", address: "福岡市東区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 4 },
  { id: "c-g03", name: "九州電力株式会社", kana: "きゅうしゅうでんりょく", industry: "エネルギー", address: "福岡市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 3 },
  { id: "c-g04", name: "コスモス薬品株式会社", kana: "こすもすやっぴん", industry: "小売", address: "福岡市博多区", ownerName: "古野", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 16 },
  { id: "c-g05", name: "株式会社資さんうどん", kana: "すけさん", industry: "外食", address: "北九州市小倉北区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 5 },
  { id: "c-g06", name: "株式会社ピエトロ", kana: "ぴえとろ", industry: "食品", address: "福岡市中央区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 9 },
  { id: "c-g07", name: "株式会社博多一風堂", kana: "いっぷうどう", industry: "外食", address: "福岡市博多区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 6 },
  { id: "c-g08", name: "安川電機株式会社", kana: "やすかわでんき", industry: "製造", address: "北九州市八幡西区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 2 },
  { id: "c-g09", name: "株式会社肥後銀行", kana: "ひごぎんこう", industry: "金融", address: "熊本市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 10 },
  { id: "c-g10", name: "株式会社鹿児島銀行", kana: "かごしまぎんこう", industry: "金融", address: "鹿児島市", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 8 },
  { id: "c-g11", name: "株式会社大分銀行", kana: "おおいたぎんこう", industry: "金融", address: "大分市", ownerName: "古野", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 14 },
  { id: "c-g12", name: "宮崎太陽銀行株式会社", kana: "みやざきたいよう", industry: "金融", address: "宮崎市", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 11 },
  { id: "c-g13", name: "トヨタ自動車九州株式会社", kana: "とよたきゅうしゅう", industry: "製造", address: "宮若市", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 3 },
  { id: "c-g14", name: "日産自動車九州株式会社", kana: "にっさんきゅうしゅう", industry: "製造", address: "北九州市小倉北区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 9 },
  { id: "c-g15", name: "ダイハツ九州株式会社", kana: "だいはつきゅうしゅう", industry: "製造", address: "大分県中津市", ownerName: "松田", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 13 },
  { id: "c-g16", name: "株式会社ふくや", kana: "ふくや", industry: "食品", address: "福岡市博多区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 5 },
  { id: "c-g17", name: "株式会社アステム", kana: "あすてむ", industry: "卸売", address: "大分市", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 7 },
  { id: "c-g18", name: "株式会社MrMax", kana: "みすたーまっくす", industry: "小売", address: "福岡市東区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 4 },
  { id: "c-g19", name: "株式会社博多大丸", kana: "はかただいまる", industry: "小売", address: "福岡市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 12 },
  { id: "c-g20", name: "株式会社新日本製鐵住金九州", kana: "しんにほんせいてつ", industry: "製造", address: "北九州市戸畑区", ownerName: "松田", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 17 },
  { id: "c-g21", name: "三井松島ホールディングス株式会社", kana: "みついまつしま", industry: "エネルギー", address: "福岡市中央区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 8 },
  { id: "c-g22", name: "コカ・コーラボトラーズジャパン", kana: "こかこーら", industry: "食品", address: "福岡市東区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 6 },
  { id: "c-g23", name: "株式会社ジーユーHD", kana: "じーゆー", industry: "小売", address: "福岡市博多区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 5 },
  { id: "c-g24", name: "株式会社久原本家", kana: "くばらほんけ", industry: "食品", address: "糟屋郡久山町", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 10 },
  { id: "c-g25", name: "九州産業交通ホールディングス", kana: "くすさんこう", industry: "運輸", address: "熊本市中央区", ownerName: "松田", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 19 },
  { id: "c-g26", name: "福岡ソフトバンクホークス", kana: "ほーくす", industry: "スポーツ", address: "福岡市中央区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 3 },
  { id: "c-g27", name: "株式会社アビスパ福岡", kana: "あびすぱ", industry: "スポーツ", address: "福岡市東区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 8 },
  { id: "c-g28", name: "株式会社サガン鳥栖", kana: "さがん", industry: "スポーツ", address: "佐賀県鳥栖市", ownerName: "松田", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 22 },
  { id: "c-g29", name: "株式会社九州フィナンシャルグループ", kana: "きゅうしゅうふぃなんしゃる", industry: "金融", address: "鹿児島市", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 11 },
  { id: "c-g30", name: "株式会社西日本新聞社", kana: "にしにっぽんしんぶん", industry: "メディア", address: "福岡市中央区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 9 },
  { id: "c-g31", name: "RKB毎日ホールディングス", kana: "あーるけーびー", industry: "メディア", address: "福岡市早良区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 14 },
  { id: "c-g32", name: "九州朝日放送株式会社", kana: "きゅうしゅうあさひ", industry: "メディア", address: "福岡市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 7 },
  { id: "c-g33", name: "株式会社テレビ西日本", kana: "てれびにしにっぽん", industry: "メディア", address: "福岡市早良区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 13 },
  { id: "c-g34", name: "株式会社久光製薬", kana: "ひさみつ", industry: "製薬", address: "佐賀県鳥栖市", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 6 },
  { id: "c-g35", name: "株式会社ヤマウラ建設", kana: "やまうら", industry: "建設", address: "北九州市小倉北区", ownerName: "古野", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 18 },
  { id: "c-g36", name: "福岡中央銀行株式会社", kana: "ふくおかちゅうおう", industry: "金融", address: "福岡市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 9 },
  { id: "c-g37", name: "株式会社ベスト電器", kana: "べすとでんき", industry: "小売", address: "福岡市中央区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 11 },
  { id: "c-g38", name: "サニックス株式会社", kana: "さにっくす", industry: "環境", address: "福岡市博多区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 5 },
  { id: "c-g39", name: "九州リース株式会社", kana: "きゅうしゅうりーす", industry: "金融", address: "福岡市中央区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 8 },
  { id: "c-g40", name: "株式会社福岡リアルティ", kana: "ふくおかりありてぃ", industry: "不動産", address: "福岡市中央区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 10 },
  { id: "c-g41", name: "東邦金属株式会社", kana: "とうほうきんぞく", industry: "製造", address: "北九州市若松区", ownerName: "古野", healthColor: "yellow", contracts: [], mrr: 0, lastTouchDays: 20 },
  { id: "c-g42", name: "株式会社トーホー食品", kana: "とーほー", industry: "食品", address: "福岡市博多区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 7 },
  { id: "c-g43", name: "株式会社メガネトップ九州", kana: "めがねとっぷ", industry: "小売", address: "福岡市博多区", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 12 },
  { id: "c-g44", name: "株式会社牧のうどん", kana: "まきのうどん", industry: "外食", address: "福岡市早良区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 15 },
  { id: "c-g45", name: "株式会社リンガーハット", kana: "りんがーはっと", industry: "外食", address: "長崎市", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 6 },
  { id: "c-g46", name: "株式会社ブリヂストン九州", kana: "ぶりぢすとん", industry: "製造", address: "久留米市", ownerName: "松田", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 9 },
  { id: "c-g47", name: "株式会社アルネット", kana: "あるねっと", industry: "IT", address: "福岡市中央区", ownerName: "古野", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 4 },
  { id: "c-g48", name: "株式会社オルトプラス九州", kana: "おるとぷらす", industry: "IT", address: "福岡市博多区", ownerName: "三木", healthColor: "green", contracts: [], mrr: 0, lastTouchDays: 13 }
];

// ─────────────────────────────────────────────
// 契約の大量生成
// ACADEMIA: PJT共創 10 / リーダー育成 14
// 評議会:  standard 24
// コミュマネ: standard 50
// AIKEN: basic 15 / advance 15
// ─────────────────────────────────────────────

// 全60社のIDリスト
const allCompanyIds: string[] = [
  // 既存12社
  "c-aeon", "c-nishitetsu", "c-ffg", "c-kyudenko", "c-jrq", "c-fukugin",
  "c-yamae", "c-toto", "c-nccb", "c-saibugas", "c-fukuokashi", "c-levias",
  // 追加48社
  ...Array.from({ length: 48 }, (_, i) => `c-g${String(i + 1).padStart(2, "0")}`)
];

const owners = ["古野", "松田", "三木"] as const;

// 決定論的なhash関数（seed値から擬似乱数）
function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickOwner(seed: number): string {
  return owners[Math.floor(rand(seed) * owners.length)];
}

// 指定件数分 companyIds をシャッフルして返す（重複なし）
function pickCompanies(seed: number, count: number, pool: string[] = allCompanyIds): string[] {
  const arr = [...pool];
  // Fisher-Yates (seeded)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

// 日付ユーティリティ
function addMonths(base: string, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const TODAY = "2026-04-24";

// 契約開始日の分布: 過去24ヶ月〜未来3ヶ月
function pickStartDate(seed: number): string {
  const offset = Math.floor(rand(seed) * 27) - 24; // -24 ~ +3
  return addMonths(TODAY, offset);
}

// オンボ状態判定: 開始日が未来（あるいは直近30日以内）ならin_progress
function determineOnboardingStatus(startDate: string): "in_progress" | "complete" {
  const diff =
    (new Date(startDate).getTime() - new Date(TODAY).getTime()) /
    (1000 * 60 * 60 * 24);
  // 開始日から30日以内（+未来）ならin_progress
  if (diff > -30) return "in_progress";
  return "complete";
}

// 継続型のフェーズ割り当て（完了済契約のみ）
const phasesByProduct: Record<ProductCode, string[]> = {
  academia: ["intro", "q1", "mid", "q2", "graduate"],
  hyogikai: ["intro", "running", "closing"],
  aiken: ["trial", "continue", "expand"],
  commu: ["intro", "running", "renewal"]
};

function pickPhase(seed: number, product: ProductCode): string {
  const phases = phasesByProduct[product];
  return phases[Math.floor(rand(seed) * phases.length)];
}

// 1契約分のデータ生成
function makeContract(
  id: string,
  companyId: string,
  product: ProductCode,
  courseKey: string,
  seed: number
): ActiveContract {
  const startDate = pickStartDate(seed);
  const status = determineOnboardingStatus(startDate);
  const ownerName = pickOwner(seed);

  // MRR / Revenue
  let mrr: number | undefined;
  let revenue: number | undefined;
  let endDate: string | undefined;
  let participants = 3;

  if (product === "academia") {
    mrr = 300_000;
    endDate = addMonths(startDate, 12);
    participants = courseKey === "pjt" ? 3 : 3;
  } else if (product === "hyogikai") {
    mrr = 150_000;
    endDate = addMonths(startDate, 12);
    participants = 3 + Math.floor(rand(seed + 1) * 3); // 3~5
  } else if (product === "commu") {
    mrr = 120_000;
    endDate = addMonths(startDate, 3);
    participants = 4 + Math.floor(rand(seed + 2) * 8); // 4~11
  } else if (product === "aiken") {
    revenue = courseKey === "basic" ? 380_000 : 520_000;
    participants = courseKey === "basic"
      ? 6 + Math.floor(rand(seed + 3) * 12)  // 6~17
      : 3 + Math.floor(rand(seed + 3) * 8);  // 3~10
  }

  return {
    id,
    companyId,
    product,
    courseKey,
    planName: undefined, // courseKeyから解決するため不要
    startDate,
    endDate,
    mrr,
    revenue,
    ownerName,
    participants,
    onboardingStatus: status,
    currentPhase: status === "complete" ? pickPhase(seed + 100, product) : undefined,
    phaseEnteredAt: status === "complete" ? addMonths(startDate, 1) : undefined
  };
}

// ─────────────────────────────────────────────
// 契約セットを生成
// ─────────────────────────────────────────────
const bulkContracts: ActiveContract[] = [];
let contractSeed = 1000;

function genBatch(
  product: ProductCode,
  courseKey: string,
  count: number,
  pool: string[] = allCompanyIds
) {
  const cos = pickCompanies(contractSeed, count, pool);
  cos.forEach((cid, i) => {
    const id = `b-${product}-${courseKey}-${i + 1}`;
    bulkContracts.push(makeContract(id, cid, product, courseKey, contractSeed + i));
  });
  contractSeed += 200;
}

genBatch("academia", "pjt", 10);
genBatch("academia", "leader", 14);
genBatch("hyogikai", "standard", 24);
genBatch("commu", "standard", 50);
genBatch("aiken", "basic", 15);
genBatch("aiken", "advance", 15);

export const bulkActiveContracts: ActiveContract[] = bulkContracts;
