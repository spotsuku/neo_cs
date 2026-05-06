"use server";

// 企業情報 (基本情報) の編集 Server Action

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/repository/server";

export type CompanyEditPatch = {
  name?: string;
  kana?: string;
  industry?: string;
  group?: string;
  address?: string;
  ownerName?: string;
  /** 共有Drive フォルダURL (営業引継ぎ後にCSが手で記録) */
  driveFolderUrl?: string | null;
  /** 企業ロゴ画像URL */
  logoUrl?: string;
  memo?: string;
  /** Gmail 連携: 自動企業マッピングに使うメールドメイン（複数可） */
  domains?: string[];
};

export type UpdateCompanyResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION" | "UNKNOWN"; message: string };

export async function updateCompanyBasicInfoAction(input: {
  companyId: string;
  patch: CompanyEditPatch;
}): Promise<UpdateCompanyResult> {
  // 軽いバリデーション (空の必須項目を弾く)
  const trimmed = (v: string | undefined) => (v ?? "").trim();
  if (input.patch.name !== undefined && trimmed(input.patch.name).length === 0) {
    return { ok: false, code: "VALIDATION", message: "企業名は必須です" };
  }
  if (
    input.patch.industry !== undefined &&
    trimmed(input.patch.industry).length === 0
  ) {
    return { ok: false, code: "VALIDATION", message: "業種は必須です" };
  }
  // URL 形式の軽いチェック (空文字は通す)
  const validateUrl = (v: string | null | undefined, label: string): string | null => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    if (t.length === 0) return null;
    if (!/^https?:\/\//i.test(t)) return `${label}は http(s):// から始めてください`;
    return null;
  };
  const driveErr = validateUrl(input.patch.driveFolderUrl, "共有DriveのURL");
  if (driveErr) return { ok: false, code: "VALIDATION", message: driveErr };
  // ロゴ画像は data URI も許容 (アップロードで data: スキームになる)
  const logoRaw = (input.patch.logoUrl ?? "").trim();
  if (logoRaw.length > 0 && !/^(https?:\/\/|data:image\/)/i.test(logoRaw)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "ロゴ画像は http(s):// から始まるURLか、画像アップロードで指定してください"
    };
  }
  // data URI のサイズ上限 (~ 1MB を base64 換算で約 1.4MB の文字列)
  if (logoRaw.startsWith("data:") && logoRaw.length > 1_500_000) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "ロゴ画像が大きすぎます (1MB以内の画像を選択してください)"
    };
  }

  const repo = getRepo();
  try {
    // 任意項目の空文字は undefined / null 扱いに正規化
    const patch: CompanyEditPatch = { ...input.patch };
    if (patch.group !== undefined) patch.group = trimmed(patch.group) || undefined;
    if (patch.memo !== undefined) patch.memo = trimmed(patch.memo) || undefined;
    if (patch.kana !== undefined) patch.kana = trimmed(patch.kana);
    if (patch.address !== undefined) patch.address = trimmed(patch.address);
    if (patch.ownerName !== undefined) patch.ownerName = trimmed(patch.ownerName);
    if (patch.name !== undefined) patch.name = trimmed(patch.name);
    if (patch.industry !== undefined) patch.industry = trimmed(patch.industry);
    if (patch.driveFolderUrl !== undefined) {
      const t = (patch.driveFolderUrl ?? "").trim();
      patch.driveFolderUrl = t.length > 0 ? t : null;
    }
    if (patch.logoUrl !== undefined) patch.logoUrl = trimmed(patch.logoUrl) || undefined;

    // ドメイン: 小文字化・空除去・重複除去・形式チェック
    if (patch.domains !== undefined) {
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const raw of patch.domains) {
        const v = (raw ?? "").trim().toLowerCase();
        if (!v) continue;
        // 簡易形式チェック: 英数字+ハイフンのラベル.ラベル...
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(v)) {
          return {
            ok: false,
            code: "VALIDATION",
            message: `ドメイン形式が不正です: ${raw}`
          };
        }
        if (!seen.has(v)) {
          seen.add(v);
          cleaned.push(v);
        }
      }
      patch.domains = cleaned;
    }

    await repo.companies.update(input.companyId, patch);
    revalidatePath(`/companies/${input.companyId}`);
    revalidatePath("/companies");
    return { ok: true };
  } catch (e) {
    return { ok: false, code: "UNKNOWN", message: (e as Error).message };
  }
}
