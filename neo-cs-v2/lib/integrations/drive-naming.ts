/**
 * Google Drive 顧客フォルダの命名規則 (純関数)
 *
 * 命名規則 (A案):
 *   `[YYYY-MM-DD] 会社名`   例: "[2026-05-04] イオン九州"
 *
 * 将来命名規則を変更したい場合は本モジュールのみ差し替えればよい。
 *
 * 制約:
 *   - 会社名から `/` `\` 等の Drive フォルダ名禁止文字を除去
 *   - 200 文字超過は会社名側を切詰める (Drive API 上限考慮)
 *   - 前後空白は trim
 */

const FORBIDDEN_CHARS = /[\/\\<>:"|?*\x00-\x1F]/g;
const NAME_RE = /^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/;
const MAX_TOTAL = 200;

export interface BuildFolderNameInput {
  companyName: string;
  /** ISO date YYYY-MM-DD。省略時は今日 (UTC) */
  date?: string;
}

/** YYYY-MM-DD 形式に正規化 (UTC基準)。Date でも可。 */
function normalizeDate(input?: string | Date): string {
  if (!input) {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // ISO datetime 等を許容
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`drive-naming: invalid date: ${input}`);
  }
  return d.toISOString().slice(0, 10);
}

function sanitize(name: string): string {
  return name.replace(FORBIDDEN_CHARS, "").replace(/\s+/g, " ").trim();
}

export function buildFolderName(input: BuildFolderNameInput): string {
  const date = normalizeDate(input.date);
  const cleaned = sanitize(input.companyName);
  if (cleaned.length === 0) {
    throw new Error("drive-naming: companyName is required");
  }
  const prefix = `[${date}] `;
  const allowed = MAX_TOTAL - prefix.length;
  const company = cleaned.length > allowed ? cleaned.slice(0, allowed) : cleaned;
  return `${prefix}${company}`;
}

export interface ParsedFolderName {
  date: string;
  companyName: string;
}

export function parseFolderName(name: string): ParsedFolderName | null {
  const m = NAME_RE.exec(name.trim());
  if (!m) return null;
  return { date: m[1], companyName: m[2].trim() };
}
