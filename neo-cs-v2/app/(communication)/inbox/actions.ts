"use server";

// Inbox 関連の Server Actions
// 現状: 未登録の送信元メールアドレスを企業の担当者として追加するアクション。

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";
import { extractDomain, nameHintFromEmail } from "@/lib/domain/email/email-routing";

export type AddContactFromEmailInput = {
  companyId: string;
  email: string;
  /** 任意: 表示名（指定なしならメールアドレスのローカル部から推測） */
  name?: string;
};

export type AddContactFromEmailResult =
  | { ok: true; contactId: string }
  | { ok: false; code: "VALIDATION" | "UNKNOWN"; message: string };

export async function addContactFromEmailAction(
  input: AddContactFromEmailInput
): Promise<AddContactFromEmailResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !extractDomain(email)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "有効なメールアドレスを指定してください"
    };
  }
  if (!input.companyId) {
    return { ok: false, code: "VALIDATION", message: "企業IDが必要です" };
  }

  const repo = getRepo();
  try {
    // 既に同じメールが登録されていないか軽くチェック
    const existing = await repo.contacts.listByCompany(input.companyId);
    const dup = existing.find((c) => c.email.toLowerCase() === email);
    if (dup) {
      return { ok: true, contactId: dup.id };
    }

    const created = await repo.contacts.create({
      companyId: input.companyId,
      name: (input.name ?? "").trim() || nameHintFromEmail(email),
      department: "",
      title: "",
      email,
      isPrimary: false,
      products: []
    });

    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/inbox");
    return { ok: true, contactId: created.id };
  } catch (e) {
    return {
      ok: false,
      code: "UNKNOWN",
      message: e instanceof Error ? e.message : String(e)
    };
  }
}
