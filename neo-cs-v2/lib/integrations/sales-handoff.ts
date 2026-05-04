/**
 * 営業 (neo-sales) → CS 引き継ぎ ペイロード処理ロジック
 *
 * 責務:
 *   - validatePayload: 受信した webhook body をバリデート (Zod 等を使わず手書きで軽量化)
 *   - mapToCompanyData: companies INSERT 用の正規化
 *   - mapToContractData: contracts INSERT 用の正規化 (start_date, term_months → end_date 計算)
 *
 * このファイルは server-only ではない (純関数のみ)。
 * テスト容易性のため Repository / DB アクセスは含まない。
 */

export type ProductCode = "academia" | "hyogikai" | "aiken" | "commu";
const VALID_PRODUCTS: ProductCode[] = ["academia", "hyogikai", "aiken", "commu"];

export interface SalesHandoffPayload {
  salesDealId: string;
  company: {
    name: string;
    industry?: string | null;
    size?: string | null;
    website?: string | null;
  };
  primaryContact: {
    name: string;
    email?: string | null;
    role?: string | null;
    phone?: string | null;
  };
  contract: {
    productCode: ProductCode;
    courseCode?: string | null;
    startDate: string; // ISO date YYYY-MM-DD
    termMonths?: number | null;
    amountJpy?: number | null;
  };
  salesOwner?: {
    email?: string | null;
  } | null;
  notes?: string | null;
  occurredAt?: string | null; // ISO8601
}

export type ValidationResult =
  | { ok: true; data: SalesHandoffPayload }
  | { ok: false; errors: string[] };

export function validatePayload(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["payload is not an object"] };
  }
  const i = input as Record<string, unknown>;

  if (typeof i.salesDealId !== "string" || i.salesDealId.trim() === "") {
    errors.push("salesDealId is required (string)");
  }

  const company = i.company as Record<string, unknown> | undefined;
  if (!company || typeof company !== "object") {
    errors.push("company is required");
  } else {
    if (typeof company.name !== "string" || company.name.trim() === "") {
      errors.push("company.name is required (string)");
    }
  }

  const contact = i.primaryContact as Record<string, unknown> | undefined;
  if (!contact || typeof contact !== "object") {
    errors.push("primaryContact is required");
  } else {
    if (typeof contact.name !== "string" || contact.name.trim() === "") {
      errors.push("primaryContact.name is required (string)");
    }
  }

  const contract = i.contract as Record<string, unknown> | undefined;
  if (!contract || typeof contract !== "object") {
    errors.push("contract is required");
  } else {
    if (
      typeof contract.productCode !== "string" ||
      !VALID_PRODUCTS.includes(contract.productCode as ProductCode)
    ) {
      errors.push(
        `contract.productCode must be one of: ${VALID_PRODUCTS.join(",")}`,
      );
    }
    if (typeof contract.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(contract.startDate)) {
      errors.push("contract.startDate must be ISO date (YYYY-MM-DD)");
    }
    if (
      contract.termMonths != null &&
      (typeof contract.termMonths !== "number" || contract.termMonths <= 0)
    ) {
      errors.push("contract.termMonths must be a positive number");
    }
    if (
      contract.amountJpy != null &&
      (typeof contract.amountJpy !== "number" || contract.amountJpy < 0)
    ) {
      errors.push("contract.amountJpy must be a non-negative number");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: input as SalesHandoffPayload };
}

/**
 * companies に INSERT するためのデータ
 * id は呼び出し側で生成 (cuid-like / uuid 任意)
 */
export interface CompanyInsert {
  name: string;
  industry: string | null;
  memo: string | null;
}

export function mapToCompanyData(p: SalesHandoffPayload): CompanyInsert {
  const memoParts: string[] = [];
  if (p.company.size) memoParts.push(`従業員規模: ${p.company.size}`);
  if (p.company.website) memoParts.push(`Website: ${p.company.website}`);
  if (p.notes) memoParts.push(`営業引継ぎメモ: ${p.notes}`);
  return {
    name: p.company.name.trim(),
    industry: p.company.industry?.trim() || null,
    memo: memoParts.length > 0 ? memoParts.join("\n") : null,
  };
}

export interface ContactInsert {
  name: string;
  title: string | null;
  email: string | null;
  tel: string | null;
  is_primary: true;
}

export function mapToContactData(p: SalesHandoffPayload): ContactInsert {
  return {
    name: p.primaryContact.name.trim(),
    title: p.primaryContact.role?.trim() || null,
    email: p.primaryContact.email?.trim() || null,
    tel: p.primaryContact.phone?.trim() || null,
    is_primary: true,
  };
}

export interface ContractInsert {
  product_code: ProductCode;
  course_key: string | null;
  start_date: string;
  end_date: string | null;
  total_revenue: number | null;
  status: "handoff";
}

export function mapToContractData(p: SalesHandoffPayload): ContractInsert {
  return {
    product_code: p.contract.productCode,
    course_key: p.contract.courseCode?.trim() || null,
    start_date: p.contract.startDate,
    end_date: computeEndDate(p.contract.startDate, p.contract.termMonths ?? null),
    total_revenue: p.contract.amountJpy ?? null,
    status: "handoff",
  };
}

/**
 * start_date + termMonths → end_date
 *   end = start + termMonths ヶ月 - 1 日
 * 例: 2026-06-01 + 12ヶ月 = 2027-06-01 → -1日 = 2027-05-31
 *     月跨ぎで日が存在しない場合 (1/31 + 1ヶ月) はその月末に丸める
 */
export function computeEndDate(startDate: string, termMonths: number | null): string | null {
  if (termMonths == null || termMonths <= 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // start + termMonths ヶ月 (1-indexed)
  const totalMonths0 = mo - 1 + termMonths;
  const targetY = y + Math.floor(totalMonths0 / 12);
  const targetMo = (totalMonths0 % 12) + 1;
  const lastDay = new Date(targetY, targetMo, 0).getDate();
  const targetD = Math.min(d, lastDay);
  // -1 日
  const endDate = new Date(Date.UTC(targetY, targetMo - 1, targetD));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const ey = endDate.getUTCFullYear();
  const em = endDate.getUTCMonth() + 1;
  const ed = endDate.getUTCDate();
  return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
}
