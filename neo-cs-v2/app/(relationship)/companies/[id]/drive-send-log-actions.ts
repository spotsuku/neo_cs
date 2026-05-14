"use server";

// 企業カルテ - Drive テンプレ資料 送付履歴 追加 Server Action (F4)
//
// 「どの企業に / いつ / どの版の資料を / 誰が / どのチャネルで送ったか」
// を手動で記録するための薄いアクション。
// recordDriveSend() ラッパ経由で driveSendLogRepo.create() を呼ぶだけ。
//
// supabase/migrations/0045_drive_send_logs.sql に対応するテーブルへ書き込む。

import { revalidatePath } from "next/cache";
import { getPermissionContext } from "@/lib/auth/server";
import { recordDriveSend } from "@/lib/integrations/google-drive";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import type { DriveSendChannel } from "@/lib/repository/types";

export type AddDriveSendLogInput = {
  companyId: string;
  driveFileName: string;
  driveFileId?: string;
  sentToEmail: string;
  sentVia: DriveSendChannel;
  sentAt?: string;
  note?: string;
};

export type AddDriveSendLogResult =
  | { ok: true }
  | { ok: false; message: string };

export async function addDriveSendLogAction(
  input: AddDriveSendLogInput
): Promise<AddDriveSendLogResult> {
  const fileName = input.driveFileName.trim();
  if (!fileName) {
    return { ok: false, message: "資料名を入力してください" };
  }
  const sentTo = input.sentToEmail.trim();
  if (!sentTo) {
    return { ok: false, message: "送信先メールを入力してください" };
  }
  // ざっくり email 形式チェック (RFC厳密ではない)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sentTo)) {
    return { ok: false, message: "送信先メールの形式が正しくありません" };
  }

  try {
    const ctx = await getPermissionContext();
    const userId = ctx.actor?.id;
    if (!userId) {
      return { ok: false, message: "ログインが必要です" };
    }

    await recordDriveSend({
      organizationId: ctx.actor?.organizationId ?? DEFAULT_ORG_ID,
      companyId: input.companyId,
      // driveFileId は任意。空文字なら「手動記録 (file 未紐付)」として扱う
      driveFileId: input.driveFileId?.trim() || "manual",
      driveFileName: fileName,
      sentToEmail: sentTo,
      sentByUserId: userId,
      sentVia: input.sentVia,
      note: input.note?.trim() || undefined,
      sentAt: input.sentAt || undefined
    });

    revalidatePath(`/companies/${input.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
