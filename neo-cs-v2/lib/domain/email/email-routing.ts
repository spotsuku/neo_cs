// Gmail 連携: 送信元メールアドレスから企業/担当者を解決する純関数群
//
// 設計:
//   - 完全一致（contacts.email）優先
//   - 一致なしならドメインで company.domains[] を逆引き
//   - フリーメール（gmail.com 等）は意図的にマッチさせない

import type { Company, Contact } from "@/lib/mock/entities";

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

/** メールアドレスからドメイン部分を抽出（小文字化）。失敗時 null。 */
export function extractDomain(email: string): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim() || null;
}

/** ドメインがフリーメールかどうか */
export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/** 送信元メールから companion/contact を完全一致で逆引き */
export function findContactByEmail(
  email: string,
  contacts: Contact[]
): Contact | null {
  const lower = email.toLowerCase();
  return contacts.find((c) => c.email.toLowerCase() === lower) ?? null;
}

/** ドメイン → そのドメインを持つ company を返す（複数なら最初の一致） */
export function findCompanyByDomain(
  domain: string,
  companies: Company[]
): Company | null {
  const d = domain.toLowerCase();
  if (isFreeEmailDomain(d)) return null;
  return (
    companies.find((c) => (c.domains ?? []).some((x) => x.toLowerCase() === d)) ??
    null
  );
}

export type EmailResolution =
  /** contacts に exact match → 既知の担当者 */
  | { kind: "known_contact"; contact: Contact; company: Company | null }
  /** ドメイン一致のみ → 未登録の送信元だが企業はわかる（担当者追加提案候補） */
  | { kind: "domain_match"; domain: string; company: Company }
  /** 何も解決できない（社内 / フリーメール / 未知ドメイン） */
  | { kind: "unknown"; domain: string | null };

/**
 * 受信メールの送信元を companies/contacts と突き合わせて解決する。
 * UI では:
 *   - known_contact   → そのまま FromLine 表示
 *   - domain_match    → 「未登録の送信元・同社の担当者として追加？」を提案
 *   - unknown         → メールアドレスのみ表示
 */
export function resolveSenderEmail(
  email: string,
  companies: Company[],
  contacts: Contact[]
): EmailResolution {
  const contact = findContactByEmail(email, contacts);
  if (contact) {
    const company = companies.find((c) => c.id === contact.companyId) ?? null;
    return { kind: "known_contact", contact, company };
  }
  const domain = extractDomain(email);
  if (!domain) return { kind: "unknown", domain: null };
  if (isFreeEmailDomain(domain)) return { kind: "unknown", domain };
  const company = findCompanyByDomain(domain, companies);
  if (company) return { kind: "domain_match", domain, company };
  return { kind: "unknown", domain };
}

/** メールアドレスから「@より前」を取り出して仮の氏名にする（提案表示用） */
export function nameHintFromEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
