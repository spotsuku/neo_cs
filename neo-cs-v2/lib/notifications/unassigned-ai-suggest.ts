/**
 * 未割当メールスレッド → AI 企業候補提示 自動ディスパッチャ
 *
 * 役割:
 *   - companyId=null の email_threads を定期的に走査し、
 *     suggestCompanyForThread() を呼んで ai_extractions に
 *     extractionType="company_suggestion" の履歴を残す。
 *   - UI (/inbox/unassigned) を開いた時点で既に候補が表示できるようにする
 *     先回り処理。
 *
 * 設計判断:
 *   - dedup は専用 I/F を追加せず、run cap (maxPerRun) で AI コストを抑制する
 *     方針を採用 (タスク指示の「推奨」案)。
 *     emailRepo.listUnassigned は last_inbound_at / last_outbound_at の
 *     新しい順で返るため、活動が新しいスレッドが優先的に処理される。
 *     既に提案済みスレッドへの再評価コストは許容する。
 *   - 1 件失敗してもループは継続し、errors に push する。
 *   - suggestCompanyForThread 内部で ai_extractions.create が呼ばれるため、
 *     ここから直接 aiExtractionRepo を触る必要はない。
 */

import "server-only";
import { emailRepo, companyRepo } from "@/lib/repository/server";
import { suggestCompanyForThread } from "@/lib/integrations/email-ai";

export type DispatchUnassignedAiSuggestionsResult = {
  scanned: number;
  suggested: number;
  skipped: number;
  errors: string[];
};

export async function dispatchUnassignedAiSuggestions(opts?: {
  maxPerRun?: number;
}): Promise<DispatchUnassignedAiSuggestionsResult> {
  const maxPerRun = opts?.maxPerRun ?? 20;
  const errors: string[] = [];
  let suggested = 0;
  let skipped = 0;

  const threads = await emailRepo.listUnassigned({ limit: maxPerRun });
  if (threads.length === 0) {
    return { scanned: 0, suggested: 0, skipped: 0, errors };
  }

  // companies は全スレッドで共通なので一度だけ取得
  const companies = await companyRepo.list();
  const companyLite = companies.map((c) => ({ id: c.id, name: c.name }));

  for (const thread of threads) {
    try {
      const messages = await emailRepo.listMessages(thread.id);
      if (messages.length === 0) {
        // 本文が無いと AI 推論できないので skip
        skipped++;
        continue;
      }
      const recent = messages.slice(-3);
      const combinedBody = recent
        .map((m) => `[${m.direction} @ ${m.sentAt}]\n${m.body}`)
        .join("\n\n---\n\n");
      const latest = recent[recent.length - 1];
      const senderEmail = latest?.senderEmail ?? "";
      const recipients = latest?.recipientEmails ?? [];

      await suggestCompanyForThread({
        organizationId: thread.organizationId,
        threadId: thread.id,
        subject: thread.subject,
        body: combinedBody,
        senderEmail,
        recipients,
        companies: companyLite
      });
      suggested++;
    } catch (e) {
      errors.push(
        `[${thread.id}] ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { scanned: threads.length, suggested, skipped, errors };
}
