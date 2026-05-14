// 企業・担当者・契約・参加者・セッション・面談ログ・オンボ・パイプラインの詳細ダミーデータ

import { ProductCode } from "./data";
import { extraCompanies } from "./bulk-data";

export type Company = {
  id: string;
  /**
   * カルテ No.: 組織内で一意な整数。最初の契約日昇順で割り振る運用。
   * ユーザが手動編集可能 (重複は repo / DB unique 制約で防ぐ)。
   * 0021_karute_no.sql で companies に追加
   */
  karuteNo?: number;
  name: string;
  kana: string;
  industry: string;
  address: string;
  group?: string;
  ownerName: string;
  contracts: ProductCode[];
  // mrr: 期内契約の月額合計。Supabase 実装は contracts テーブルから集計するため
  // 「契約 0 件」や「mrr_amount NULL のみ」だと undefined。mock seed は必ず値を持つ。
  // UI 側は `c.mrr ?? 0` または「未設定 (—)」表示で都度ガードする。
  mrr?: number;
  // lastTouchDays: 最終 meeting_log からの経過日数。Supabase 実装は meeting_logs
  // が空なら undefined。旧実装は 0 固定で「0日前」誤表示の原因だった (PARITY §1.1)。
  lastTouchDays?: number;
  memo?: string;
  // Phase4-#5: Google Drive 自動連携 (テンプレフォルダ複製で生成された顧客フォルダ)
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  driveFolderCreatedAt?: string | null;
  // 0019_is_demo_flag.sql: 本番運用前のダミーデータかどうか
  // (mock の seed は明示しない=undefined。リポジトリ層で true 扱い)
  isDemo?: boolean;
  // 0027_companies_logo.sql: 企業ロゴ画像 (URL または data URI)
  logoUrl?: string;
  // Gmail 連携: この企業に紐づくメールドメイン（複数可）
  // 受信メールの送信元ドメインがここに含まれていれば、未登録の送信元でも
  // 「同社の担当者として追加するか」を提案する
  domains?: string[];
};

// ─────────────────────────────────────────────
// 企業 seed (再整理版)
//
// 構成:
//   - アカデミア リーダー育成 active (18社, 3期目): A-LEADER
//   - アカデミア PJT共創 active   (8社,  3期目): A-PJT
//   - アカデミア 1期解約         (3社):        A-CHURN
//   - アカデミア→評議会移行       (1社):        A-MIGRATE
//   - 評議会単独 active          (9社, 3期目): H-ONLY
//   - AI研修 (4回×3社=12社):                 K-{R}-{i}
//   - コミュマネ 第1回 (3社):                C
//
// ※ アカデミアには評議会参加権が付帯するため hyogikai は contracts 配列に
//   含めない (UI 側で「+評議会」付帯バッジを出す)
// ─────────────────────────────────────────────
type SeedRow = {
  id: string;
  name: string;
  kana: string;
  industry: string;
  address: string;
  group?: string;
  ownerName: string;
  contracts: ProductCode[];
  mrr: number;
  lastTouchDays: number;
  memo?: string;
};

// ※ 以下の社名はすべて架空。実在する企業・団体とは関係ありません。
//   id (c-xxx) のみ既存コードとの互換のため維持。
const aLeaderRows: SeedRow[] = [
  { id: "c-aeon",       name: "アルファ商事株式会社",       kana: "あるふぁしょうじ",        industry: "小売",   address: "デモ市第1区",     group: "アルファグループ", ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 18 },
  { id: "c-nishitetsu", name: "ベータ鉄道株式会社",          kana: "べーたてつどう",          industry: "鉄道",   address: "デモ市第1区",     ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 12 },
  { id: "c-jrq",        name: "ガンマ旅客鉄道株式会社",      kana: "がんまりょかく",          industry: "鉄道",   address: "デモ市第1区",     ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 21 },
  { id: "c-ffg",        name: "デルタ・フィナンシャルグループ", kana: "でるたふぃなんしゃる", industry: "金融",   address: "デモ市第2区",     ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 5 },
  { id: "c-fukugin",    name: "イプシロン銀行株式会社",      kana: "いぷしろんぎんこう",      industry: "金融",   address: "デモ市第2区",     group: "デルタFG", ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 8 },
  { id: "c-toto",       name: "ゼータ住設株式会社",          kana: "ぜーたじゅうせつ",        industry: "住宅設備", address: "デモ第二都市A区",  ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 3 },
  { id: "c-yamae",      name: "イータ卸売ホールディングス",  kana: "いーたおろし",            industry: "卸売",   address: "デモ市第1区",     ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 14 },
  { id: "c-kyuden",     name: "シータ電力株式会社",          kana: "しーたでんりょく",        industry: "エネルギー", address: "デモ市第2区",   ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 6 },
  { id: "c-yasukawa",   name: "イオタ精機株式会社",          kana: "いおたせいき",            industry: "製造",   address: "デモ第二都市B区",  ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 4 },
  { id: "c-toyota9",    name: "カッパオートモーション株式会社", kana: "かっぱおーとも",       industry: "製造",   address: "デモ第三市",       ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 3 },
  { id: "c-nissan9",    name: "ラムダドライブテック株式会社",kana: "らむだどらいぶ",         industry: "製造",   address: "デモ第二都市A区",  ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 9 },
  { id: "c-saibugas",   name: "ミュー都市ガスHD",            kana: "みゅーとしがす",          industry: "エネルギー", address: "デモ市第1区",   ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 7 },
  { id: "c-japanet",    name: "ニュー通販ホールディングス",  kana: "にゅーつうはん",          industry: "通販",   address: "デモ西県第1市",    ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 7 },
  { id: "c-trial",      name: "クシー流通HD",                kana: "くしーりゅうつう",        industry: "小売",   address: "デモ市第3区",     ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 4 },
  { id: "c-cosmos",     name: "オミクロン薬品株式会社",      kana: "おみくろんやくひん",      industry: "小売",   address: "デモ市第1区",     ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 16 },
  { id: "c-mitsuimatsu",name: "パイ資源ホールディングス",   kana: "ぱいしげん",              industry: "エネルギー", address: "デモ市第2区",  ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 8 },
  { id: "c-cocacola",   name: "ロー飲料株式会社",            kana: "ろーいんりょう",          industry: "食品",   address: "デモ市第3区",     ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 6 },
  { id: "c-shinnippon", name: "シグマ製鉄株式会社",          kana: "しぐませいてつ",          industry: "製造",   address: "デモ第二都市C区",  ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 17 }
];

const aPjtRows: SeedRow[] = [
  { id: "c-pietro",     name: "タウ食品株式会社",            kana: "たうしょくひん",          industry: "食品",   address: "デモ市第2区",     ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 9 },
  { id: "c-fukuya",     name: "ウプシロンフードラボ",        kana: "うぷしろんふーど",        industry: "食品",   address: "デモ市第1区",     ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 5 },
  { id: "c-kuhara",     name: "ファイ商事株式会社",          kana: "ふぁいしょうじ",          industry: "食品",   address: "デモ郡A町",        ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 10 },
  { id: "c-fukuokashi", name: "サンプル中央市役所",          kana: "さんぷるちゅうおう",      industry: "自治体", address: "デモ市第2区",     ownerName: "古野", contracts: ["academia"], mrr: 300_000, lastTouchDays: 11 },
  { id: "c-rkb",        name: "カイ放送株式会社",            kana: "かいほうそう",            industry: "メディア", address: "デモ市第4区",   ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 4 },
  { id: "c-nbc",        name: "プサイ新聞社",                kana: "ぷさいしんぶん",          industry: "メディア", address: "デモ市第2区",   ownerName: "三木", contracts: ["academia"], mrr: 300_000, lastTouchDays: 8 },
  { id: "c-airport",    name: "オメガ国際空港株式会社",      kana: "おめがくうこう",          industry: "運輸",   address: "デモ市第1区",     ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 13 },
  { id: "c-asakura",    name: "サンプル東部商工会議所",      kana: "さんぷるとうぶ",          industry: "自治体", address: "デモ東市",         ownerName: "松田", contracts: ["academia"], mrr: 300_000, lastTouchDays: 22 }
];

const aChurnRows: SeedRow[] = [
  { id: "c-ippudo",     name: "ファストヌードル株式会社",    kana: "ふぁすとぬーどる",        industry: "外食",   address: "デモ市第1区",     ownerName: "三木", contracts: [], mrr: 0, lastTouchDays: 180, memo: "1期で解約・以降未接触" },
  { id: "c-suke",       name: "ハートフードサービス",        kana: "はーとふーど",            industry: "外食",   address: "デモ第二都市A区",  ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 220, memo: "1期で解約" },
  { id: "c-mrmax",      name: "メガアウトレット株式会社",    kana: "めがあうとれっと",        industry: "小売",   address: "デモ市第3区",     ownerName: "古野", contracts: [], mrr: 0, lastTouchDays: 200, memo: "1期で解約" }
];

const aMigrateRows: SeedRow[] = [
  { id: "c-daimaru",    name: "クラシックデパート株式会社",  kana: "くらしっくでぱーと",      industry: "小売",   address: "デモ市第2区",     ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 18, memo: "アカデミア1期で解約後、評議会単独に移行" }
];

const hOnlyRows: SeedRow[] = [
  { id: "c-nccb",       name: "グランドシティ銀行株式会社",  kana: "ぐらんどしてぃ",          industry: "金融",   address: "デモ市第1区",     ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 6 },
  { id: "c-higo",       name: "レイクサイド銀行株式会社",    kana: "れいくさいど",            industry: "金融",   address: "デモ南県第1市",    ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 10 },
  { id: "c-kagoshima",  name: "サザンシティ銀行株式会社",    kana: "さざんしてぃ",            industry: "金融",   address: "デモ南県第2市",    ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 8 },
  { id: "c-oita",       name: "クロスバレー銀行株式会社",    kana: "くろすばれー",            industry: "金融",   address: "デモ東県第1市",    ownerName: "古野", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 14 },
  { id: "c-miyazaki",   name: "サンライズ銀行株式会社",      kana: "さんらいず",              industry: "金融",   address: "デモ南県第3市",    ownerName: "松田", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 11 },
  { id: "c-kitaq",      name: "サンプル北部市役所",          kana: "さんぷるほくぶ",          industry: "自治体", address: "デモ第二都市A区",  ownerName: "古野", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 9 },
  { id: "c-fukushoko",  name: "サンプル中央商工会議所",      kana: "さんぷるちゅうおう",      industry: "自治体", address: "デモ市第1区",     ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 15 },
  { id: "c-saibu",      name: "ガスフロー都市開発株式会社",  kana: "がすふろー",              industry: "エネルギー", address: "デモ市第1区",   ownerName: "松田", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 12 },
  { id: "c-bunka9",     name: "ゴールドメディア放送",        kana: "ごーるどめでぃあ",        industry: "メディア", address: "デモ市第2区",   ownerName: "三木", contracts: ["hyogikai"], mrr: 150_000, lastTouchDays: 6 }
];

const kRows: SeedRow[] = [
  // 第4回 (current)
  { id: "c-levias",     name: "テックブリッジ株式会社",      kana: "てっくぶりっじ",          industry: "IT",     address: "デモ市第2区",     ownerName: "古野", contracts: ["aiken"], mrr: 0, lastTouchDays: 2 },
  { id: "c-aikido",     name: "クラウドネクサス株式会社",    kana: "くらうどねくさす",        industry: "IT",     address: "デモ市第1区",     ownerName: "古野", contracts: ["aiken"], mrr: 0, lastTouchDays: 5 },
  { id: "c-zenrin",     name: "マッププレックス株式会社",    kana: "まっぷぷれっくす",        industry: "IT",     address: "デモ第二都市A区",  ownerName: "松田", contracts: ["aiken"], mrr: 0, lastTouchDays: 7 },
  // 第3回 (renewed)
  { id: "c-kyudenko",   name: "エレクトリックビルダーズ",    kana: "えれくとりっくびるだーず", industry: "建設・電気", address: "デモ市第5区", ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 30 },
  { id: "c-astem",      name: "ヘルスサプライ株式会社",      kana: "へるすさぷらい",          industry: "卸売",   address: "デモ東県第1市",    ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 45 },
  { id: "c-daihatsu",   name: "リトルモーターズ株式会社",    kana: "りとるもーたーず",        industry: "製造",   address: "デモ東県第2市",    ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 50 },
  // 第2回 (renewed)
  { id: "c-hawks",      name: "ファイティングホークス株式会社", kana: "ふぁいてぃんぐ",       industry: "スポーツ", address: "デモ市第2区",   ownerName: "古野", contracts: [], mrr: 0, lastTouchDays: 90 },
  { id: "c-avispa",     name: "シティウェーブFC株式会社",    kana: "してぃうぇーぶ",          industry: "スポーツ", address: "デモ市第3区",   ownerName: "三木", contracts: [], mrr: 0, lastTouchDays: 120 },
  { id: "c-gu",         name: "ファッションラボHD",          kana: "ふぁっしょんらぼ",        industry: "小売",   address: "デモ市第1区",     ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 100 },
  // 第1回 (renewed)
  { id: "c-saibu-st",   name: "シティストア株式会社",        kana: "してぃすとあ",            industry: "小売",   address: "デモ市第1区",     ownerName: "古野", contracts: [], mrr: 0, lastTouchDays: 200 },
  { id: "c-hakata-d",   name: "ヘリテージデパート株式会社",  kana: "へりてーじでぱーと",      industry: "小売",   address: "デモ市第1区",     ownerName: "三木", contracts: [], mrr: 0, lastTouchDays: 250 },
  { id: "c-kyuko",      name: "リジョナル交通ホールディングス", kana: "りじょなるこうつう",   industry: "運輸",   address: "デモ南県第1市",    ownerName: "松田", contracts: [], mrr: 0, lastTouchDays: 300 }
];

const cRows: SeedRow[] = [
  { id: "c-fukugin-mati", name: "リバーサイドネットワーク",  kana: "りばーさいど",            industry: "自治体", address: "デモ市第1区",     ownerName: "古野", contracts: ["commu"], mrr: 120_000, lastTouchDays: 4 },
  { id: "c-kitaq-shoko",  name: "ノースサイド商工会議所",    kana: "のーすさいど",            industry: "自治体", address: "デモ第二都市A区",  ownerName: "三木", contracts: ["commu"], mrr: 120_000, lastTouchDays: 7 },
  { id: "c-omuta",        name: "ハーバーシティまちづくり協議会", kana: "はーばーしてぃ",     industry: "自治体", address: "デモ西都市",       ownerName: "松田", contracts: ["commu"], mrr: 120_000, lastTouchDays: 9 }
];

const baseCompanies: Company[] = [
  ...aLeaderRows,
  ...aPjtRows,
  ...aChurnRows,
  ...aMigrateRows,
  ...hOnlyRows,
  ...kRows,
  ...cRows
];

// ─────────────────────────────────────────────
// ダミーロゴ生成
//   - 実運用では Supabase Storage の公開 URL を companies.logo_url に保存
//   - mock では社名から決定的に色を選び、頭文字 SVG を data URI 化して埋め込む
// ─────────────────────────────────────────────
const LOGO_PALETTE = [
  ["#0EA5E9", "#0369A1"], // sky
  ["#22C55E", "#15803D"], // green
  ["#F97316", "#C2410C"], // orange
  ["#A855F7", "#6B21A8"], // purple
  ["#EF4444", "#991B1B"], // red
  ["#14B8A6", "#0F766E"], // teal
  ["#EAB308", "#854D0E"], // amber
  ["#EC4899", "#9D174D"]  // pink
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialFor(name: string): string {
  // 「株式会社」等のプレフィックス/サフィックスを除いた最初の意味のある文字
  const cleaned = name
    .replace(/^株式会社|^合同会社|^一般社団法人|^公益社団法人/g, "")
    .replace(/株式会社$|ホールディングス$|HD$/g, "")
    .trim();
  return (cleaned[0] ?? name[0] ?? "?").toUpperCase();
}

function buildLogoDataUri(name: string): string {
  const [bg, fg] = LOGO_PALETTE[hashStr(name) % LOGO_PALETTE.length];
  const ch = initialFor(name);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="12" fill="${bg}"/>` +
    `<text x="50%" y="50%" dy=".1em" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="700" fill="${fg}">${ch}</text>` +
    `</svg>`;
  // Node / Browser 双方で動く base64 化
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${b64}`;
}

function withLogo(c: Company): Company {
  return { ...c, logoUrl: c.logoUrl ?? buildLogoDataUri(c.name) };
}

export const companies: Company[] = [...baseCompanies, ...extraCompanies].map(withLogo);

// 企業担当者（企業側の担当）
// 担当ロール: scope（NEO全体 or 事業単位）× level（役員/決裁者/責任者/担当者）
// 兼務は roles 配列に複数エントリを持たせることで表現する
export type ContactRoleScope = "overall" | ProductCode;
export type ContactRoleLevel = "executive" | "approver" | "lead" | "member";
export type ContactRole = {
  scope: ContactRoleScope;
  level: ContactRoleLevel;
  /** 期 (cycleNumber)。未指定は全期共通として扱う。新規追加時は明示的に期を指定 */
  cycleNo?: number;
};
// 機能別連絡窓口タグ（契約/広報/招待/各事業連絡）
export type ContactFunction = "contract" | "pr" | "invitation" | "liaison";

// コミュニティ関与度
export type ContactCommunityTier = "core" | "active" | "casual" | "at_risk";

// 性質タグ
export type ContactPersonality =
  | "playful_leader"
  | "playful_thinker"
  | "narepan"
  | "gardon";

export type Contact = {
  id: string;
  companyId: string;
  name: string;
  department: string;
  title: string;
  email: string;
  tel?: string;
  isPrimary: boolean;
  products: ProductCode[];
  roles?: ContactRole[];
  functions?: ContactFunction[];
  community?: ContactCommunityTier;
  personality?: ContactPersonality[];
  /** 備考欄（自由記述）。趣味嗜好・関係性・関係構築のヒント等を記録 */
  note?: string;
};

export const contacts: Contact[] = [
  {
    id: "p-a1", companyId: "c-aeon", name: "田中 太郎", department: "人事部", title: "部長",
    email: "tanaka@aeon-kyushu.jp", tel: "092-123-4567", isPrimary: true, products: ["academia", "aiken", "hyogikai"],
    roles: [
      { scope: "overall", level: "lead" },
      { scope: "academia", level: "lead" },
      { scope: "aiken", level: "lead" }
    ],
    functions: ["contract", "liaison"],
    community: "core",
    personality: ["playful_leader", "narepan"]
  },
  {
    id: "p-a2", companyId: "c-aeon", name: "佐藤 花子", department: "経営企画", title: "課長",
    email: "sato@aeon-kyushu.jp", tel: "092-123-4568", isPrimary: false, products: ["academia"],
    roles: [
      { scope: "overall", level: "member" },
      { scope: "academia", level: "member" }
    ],
    functions: ["invitation"],
    community: "active",
    personality: ["playful_thinker"]
  },
  {
    id: "p-a3", companyId: "c-aeon", name: "山田 次郎", department: "役員", title: "副社長",
    email: "yamada@aeon-kyushu.jp", tel: "092-123-4500", isPrimary: false, products: ["hyogikai"],
    roles: [
      { scope: "overall", level: "executive" },
      { scope: "overall", level: "approver" },
      { scope: "hyogikai", level: "executive" },
      { scope: "hyogikai", level: "approver" }
    ],
    functions: ["pr"],
    community: "casual",
    personality: ["gardon"]
  },
  {
    id: "p-a4", companyId: "c-aeon", name: "鈴木 一郎", department: "経営企画", title: "部長",
    email: "suzuki@aeon-kyushu.jp", tel: "092-123-4570", isPrimary: false, products: ["academia", "aiken"],
    roles: [
      { scope: "academia", level: "approver" },
      { scope: "aiken", level: "approver" },
      { scope: "aiken", level: "lead" }
    ],
    functions: ["contract"],
    community: "active",
    personality: ["narepan", "playful_thinker"]
  },
  {
    id: "p-a5", companyId: "c-aeon", name: "伊藤 美咲", department: "広報部", title: "主任",
    email: "ito@aeon-kyushu.jp", tel: "090-9876-5432", isPrimary: false, products: ["hyogikai"],
    roles: [
      { scope: "hyogikai", level: "lead" },
      { scope: "hyogikai", level: "member" }
    ],
    functions: ["pr", "invitation"],
    community: "at_risk",
    personality: ["playful_thinker", "playful_leader"]
  }
];

// ─────────────────────────────────────────────
// 企業ドメインの自動シード
//   - 既存 contacts.email から company → domain set を構築し、
//     companies.domains 未指定なら埋める
//   - フリーメール (gmail.com 等) は除外: 個人メール由来の汚染を避ける
//   - 大文字小文字は無視（小文字に正規化）
// ─────────────────────────────────────────────
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.co.jp",
  "yahoo.com",
  "outlook.com",
  "outlook.jp",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "live.jp",
  "live.com"
]);

function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim() || null;
}

const domainsByCompany = new Map<string, Set<string>>();
for (const ct of contacts) {
  const d = domainFromEmail(ct.email);
  if (!d || FREE_EMAIL_DOMAINS.has(d)) continue;
  const set = domainsByCompany.get(ct.companyId) ?? new Set<string>();
  set.add(d);
  domainsByCompany.set(ct.companyId, set);
}
// contacts カバレッジ外の会社向け補完シード
//   entities.contacts 配列に登録されていないが mock email threads
//   などで送信元として登場する企業に、デモ用ドメインを手当てする
const SUPPLEMENT_DOMAIN_SEEDS: Record<string, string[]> = {
  "c-jrq": ["jrkyushu.co.jp"],
  "c-saibugas": ["saibugas.co.jp"],
  "c-ffg": ["ffg.co.jp"],
  "c-yamae": ["yamae.co.jp"],
  "c-fukuokashi": ["city.fukuoka.lg.jp"],
  "c-kyudenko": ["kyudenko.co.jp"]
};
for (const c of companies) {
  if (c.domains && c.domains.length > 0) continue;
  const seeded = domainsByCompany.get(c.id);
  const supplement = SUPPLEMENT_DOMAIN_SEEDS[c.id];
  const merged = new Set<string>([
    ...(seeded ?? []),
    ...(supplement ?? [])
  ]);
  if (merged.size > 0) c.domains = Array.from(merged).sort();
}

// 面談ログ（全研修混在・タグ付き）
export type MeetingLog = {
  id: string;
  companyId: string;
  date: string;
  product: ProductCode | "cross"; // cross = 複数研修にまたがる話題
  type: "mtg" | "mail" | "call";
  title: string;
  summary: string;
  good?: string;
  more?: string;
  next?: string;
  authorName: string;
  aiGenerated?: boolean;
  /** 面談/商談 (mtg): Notion AI議事録の URL */
  notionUrl?: string;
  /** 電話 (call): 発信元の連絡先 (contacts.id) */
  callerContactId?: string;
};

export const meetingLogs: MeetingLog[] = [
  {
    id: "m1",
    companyId: "c-aeon",
    date: "2026-04-22",
    product: "academia",
    type: "mail",
    title: "田中部長より：第15回講義の出席について",
    summary: "第15回の講義について、佐藤課長が出張で欠席となる旨の連絡。代替で別スタッフが参加希望。",
    next: "ゲスト参加の可否と手続きをNEO側で確認",
    authorName: "AI要約",
    aiGenerated: true
  },
  {
    id: "m2",
    companyId: "c-aeon",
    date: "2026-04-15",
    product: "cross",
    type: "mtg",
    title: "四半期レビューMTG（人事部長 + 古野）",
    summary: "ACADEMIA受講者3名の学習成果、評議会の議題希望、AIKEN次期派遣者の人選について議論。",
    good: "田中部長が継続意欲を明示。副社長にも取り組みをレポート済み",
    more: "ACADEMIA佐藤課長の稼働逼迫、参加頻度低下。代替要員の検討が必要",
    next: "次期派遣者リスト提案・副社長向けプレゼン資料作成",
    authorName: "古野"
  },
  {
    id: "m3",
    companyId: "c-aeon",
    date: "2026-03-28",
    product: "hyogikai",
    type: "mtg",
    title: "第5回定例会",
    summary: "テーマ「地域経済の未来」。田中部長 + 山田副社長（ゲスト）が出席。積極的な発言あり。",
    next: "第6回のアジェンダ案を5月上旬に提案",
    authorName: "三木"
  },
  {
    id: "m4",
    companyId: "c-aeon",
    date: "2026-03-10",
    product: "aiken",
    type: "call",
    title: "AIKEN派遣者からの質問対応",
    summary: "基礎コース第1回の内容について、佐藤課長が応用コースも受講したい旨の相談",
    next: "応用コース追加受講の見積を提示",
    authorName: "古野"
  }
];

// オンボタスク（研修ごとにフェーズ構成が違う）
export type OnboardingTask = {
  id: string;
  companyId: string;
  product: ProductCode;
  phase: string; // 研修ごとのphase key
  name: string;
  dueDate: string;
  status: "todo" | "doing" | "done" | "overdue";
  assignee: string;
};

// 研修ごとのフェーズ定義（設定画面で編集される想定）
export const productPhases: Record<ProductCode, { key: string; label: string; description?: string }[]> = {
  academia: [
    { key: "prep", label: "準備", description: "契約締結〜派遣者確定" },
    { key: "kickoff", label: "Kickoff", description: "開講式・初回講義" },
    { key: "q1", label: "Q1", description: "第1〜第5回講義" },
    { key: "mid", label: "中間評価", description: "中間発表・個別面談" },
    { key: "q2", label: "Q2", description: "第6〜第15回講義" },
    { key: "final", label: "最終発表", description: "最終報告会・修了式" }
  ],
  hyogikai: [
    { key: "prep", label: "準備", description: "契約〜固定メンバー確定" },
    { key: "q1", label: "Q1定例", description: "第1〜第3回" },
    { key: "q2", label: "Q2定例", description: "第4〜第6回" },
    { key: "q3", label: "Q3定例", description: "第7〜第9回" },
    { key: "closing", label: "総括", description: "第10回・総括レポート" }
  ],
  aiken: [
    { key: "prep", label: "事前準備", description: "派遣者選定・教材配布" },
    { key: "day1", label: "Day 1", description: "第1講義" },
    { key: "day2", label: "Day 2", description: "第2講義" },
    { key: "followup", label: "フォローアップ", description: "修了後アンケート・応用コース案内" }
  ],
  commu: [
    { key: "prep", label: "準備", description: "契約〜参加者確定" },
    { key: "m1", label: "1ヶ月目", description: "初回〜第2回講義" },
    { key: "m2", label: "2ヶ月目", description: "第3〜第4回講義" },
    { key: "m3", label: "3ヶ月目", description: "最終回〜更新判断" }
  ]
};

export const onboardingTasks: OnboardingTask[] = [
  // ACADEMIA
  { id: "t-a1", companyId: "c-toto", product: "academia", phase: "prep", name: "派遣者3名の確定", dueDate: "2026-05-01", status: "doing", assignee: "古野" },
  { id: "t-a2", companyId: "c-toto", product: "academia", phase: "prep", name: "開講式招待状の送付", dueDate: "2026-05-08", status: "todo", assignee: "古野" },
  { id: "t-a3", companyId: "c-saibugas", product: "academia", phase: "kickoff", name: "開講式の準備", dueDate: "2026-04-26", status: "done", assignee: "松田" },
  { id: "t-a4", companyId: "c-aeon", product: "academia", phase: "q1", name: "第5回講義の資料配布", dueDate: "2026-04-22", status: "done", assignee: "古野" },
  { id: "t-a5", companyId: "c-jrq", product: "academia", phase: "mid", name: "中間評価会アジェンダ作成", dueDate: "2026-04-28", status: "doing", assignee: "三木" },
  { id: "t-a6", companyId: "c-jrq", product: "academia", phase: "mid", name: "個別面談の日程調整", dueDate: "2026-05-10", status: "todo", assignee: "三木" },
  { id: "t-a7", companyId: "c-fukugin", product: "academia", phase: "q2", name: "第10回講義のゲスト調整", dueDate: "2026-05-15", status: "todo", assignee: "古野" },
  { id: "t-a8", companyId: "c-yamae", product: "academia", phase: "final", name: "最終発表会の会場手配", dueDate: "2026-04-30", status: "overdue", assignee: "松田" },

  // 評議会
  { id: "t-h1", companyId: "c-nccb", product: "hyogikai", phase: "prep", name: "固定メンバー3名の確定", dueDate: "2026-05-05", status: "doing", assignee: "三木" },
  { id: "t-h2", companyId: "c-fukuokashi", product: "hyogikai", phase: "q1", name: "第2回テーマ決定", dueDate: "2026-04-28", status: "doing", assignee: "三木" },
  { id: "t-h3", companyId: "c-aeon", product: "hyogikai", phase: "q2", name: "第6回ゲスト招聘", dueDate: "2026-05-10", status: "todo", assignee: "古野" },
  { id: "t-h4", companyId: "c-nishitetsu", product: "hyogikai", phase: "q2", name: "欠席フォローアップMTG", dueDate: "2026-04-22", status: "overdue", assignee: "三木" },
  { id: "t-h5", companyId: "c-jrq", product: "hyogikai", phase: "q3", name: "第7回アジェンダ共有", dueDate: "2026-05-20", status: "todo", assignee: "三木" },
  { id: "t-h6", companyId: "c-fukuokashi", product: "hyogikai", phase: "closing", name: "総括レポート作成", dueDate: "2026-06-25", status: "todo", assignee: "三木" },

  // AIKEN
  { id: "t-k1", companyId: "c-levias", product: "aiken", phase: "prep", name: "参加者アカウント発行", dueDate: "2026-05-10", status: "todo", assignee: "松田" },
  { id: "t-k2", companyId: "c-levias", product: "aiken", phase: "prep", name: "教材配布", dueDate: "2026-05-13", status: "todo", assignee: "松田" },
  { id: "t-k3", companyId: "c-toto", product: "aiken", phase: "prep", name: "派遣者選定", dueDate: "2026-05-01", status: "doing", assignee: "古野" },
  { id: "t-k4", companyId: "c-kyudenko", product: "aiken", phase: "day1", name: "Day1 会場準備", dueDate: "2026-05-02", status: "todo", assignee: "松田" },
  { id: "t-k5", companyId: "c-kyudenko", product: "aiken", phase: "day2", name: "Day2 課題提出確認", dueDate: "2026-05-09", status: "todo", assignee: "松田" },
  { id: "t-k6", companyId: "c-aeon", product: "aiken", phase: "followup", name: "修了後アンケート送付", dueDate: "2026-04-28", status: "doing", assignee: "古野" },
  { id: "t-k7", companyId: "c-aeon", product: "aiken", phase: "followup", name: "応用コース案内", dueDate: "2026-05-05", status: "todo", assignee: "古野" },

  // コミュマネ
  { id: "t-c1", companyId: "c-fukugin", product: "commu", phase: "prep", name: "Kickoff日程調整", dueDate: "2026-04-20", status: "overdue", assignee: "古野" },
  { id: "t-c2", companyId: "c-fukugin", product: "commu", phase: "prep", name: "参加者リスト受領", dueDate: "2026-04-22", status: "overdue", assignee: "古野" },
  { id: "t-c3", companyId: "c-fukugin", product: "commu", phase: "prep", name: "契約書送付", dueDate: "2026-04-25", status: "overdue", assignee: "古野" },
  { id: "t-c4", companyId: "c-fukugin", product: "commu", phase: "m1", name: "Kickoff MTG実施", dueDate: "2026-04-28", status: "todo", assignee: "古野" },
  { id: "t-c5", companyId: "c-fukugin", product: "commu", phase: "m1", name: "初回アンケート配布", dueDate: "2026-05-02", status: "todo", assignee: "古野" },
  { id: "t-c6", companyId: "c-levias", product: "commu", phase: "m2", name: "第3回講義の予習課題送付", dueDate: "2026-05-20", status: "todo", assignee: "松田" },
  { id: "t-c7", companyId: "c-kyudenko", product: "commu", phase: "m3", name: "契約更新意向確認", dueDate: "2026-05-15", status: "todo", assignee: "松田" },
  { id: "t-c8", companyId: "c-nccb", product: "commu", phase: "m3", name: "3ヶ月目サマリー作成", dueDate: "2026-06-10", status: "todo", assignee: "三木" }
];

