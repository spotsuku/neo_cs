// 未割当キュー (F3): Gmail 同期で companyId 解決に失敗したスレッドを手動アサイン
//
// gmail-sync.ts は email_domains / company_contacts.email で自動振り分けるが、
// 一致しなかったスレッドは company_id = null で残る。本画面はそれらを発見し、
// 担当者が企業を選んで紐付けるためのキュー画面。

import Link from "next/link";
import { TopNavServer } from "@/components/nav/TopNavServer";
import {
  emailRepo,
  companyRepo,
  aiExtractionRepo
} from "@/lib/repository/server";
import { getPermissionContext } from "@/lib/auth/server";
import { DEFAULT_ORG_ID } from "@/lib/repository/types";
import { UnassignedView } from "./UnassignedView";
import type { UnassignedThreadRow } from "./UnassignedView";

export default async function UnassignedInboxPage() {
  const ctx = await getPermissionContext();
  const orgId = ctx.actor?.organizationId ?? DEFAULT_ORG_ID;

  const [threads, companies] = await Promise.all([
    emailRepo.listUnassigned({ organizationId: orgId, limit: 50 }),
    companyRepo.list()
  ]);

  // 事前計算済み company_suggestion (cron 由来) を 1 クエリで束ねて取得
  const threadIds = threads.map((t) => t.id);
  const suggestions = await aiExtractionRepo.listLatestSuggestionsByThreads(
    threadIds,
    { unreviewedOnly: true }
  );
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const suggestionByThread = new Map(suggestions.map((s) => [s.sourceId, s]));

  // 各スレッドの最初の message を直列で取って direction / 相手アドレスを抽出
  // (50件 × 1クエリなので許容範囲)
  const rows: UnassignedThreadRow[] = await Promise.all(
    threads.map(async (t) => {
      const messages = await emailRepo.listMessages(t.id);
      // 直近 message
      const latest = messages[messages.length - 1];
      let counterpart: string | undefined;
      if (latest) {
        counterpart =
          latest.direction === "inbound"
            ? latest.senderEmail
            : latest.recipientEmails[0];
      }
      // 事前計算 AI 候補 (候補企業がアーカイブ済みなら表示しない)
      const sg = suggestionByThread.get(t.id);
      const sgCompany =
        sg?.companyId !== undefined ? companyById.get(sg.companyId) : undefined;
      const precomputedSuggestion =
        sg && sg.companyId && sgCompany
          ? {
              extractionId: sg.id,
              companyId: sg.companyId,
              companyName: sgCompany.name,
              confidence: sg.confidence ?? 0,
              reasoning: sg.excerpt,
              createdAt: sg.createdAt
            }
          : undefined;
      return {
        id: t.id,
        subject: t.subject,
        lastMessageAt: t.lastInboundAt ?? t.lastOutboundAt ?? t.updatedAt,
        direction: latest?.direction,
        counterpart,
        precomputedSuggestion
      };
    })
  );

  const companyOpts = companies
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <>
      <TopNavServer current="/inbox" />
      <main className="mx-auto max-w-[1500px] px-4 py-6 space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-900">
              未割当スレッド
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">
              Gmail 同期で企業に紐付かなかったスレッド ({rows.length} 件)。
              企業を選んで手動アサインします。
            </p>
          </div>
          <Link
            href="/inbox"
            className="px-3 py-1.5 rounded-full border border-ink-200 text-xs text-ink-700 hover:bg-ink-50"
          >
            ← 受信箱に戻る
          </Link>
        </header>
        <UnassignedView threads={rows} companies={companyOpts} />
      </main>
    </>
  );
}
