import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNavServer } from "@/components/TopNavServer";
import { programRepo } from "@/lib/repository/server";
import { PROGRAM_TASK_CATEGORY_LABEL } from "@/lib/domain/program";
import { TemplateEditor } from "./TemplateEditor";
import { DeleteTermButton } from "./DeleteTermButton";

export const dynamic = "force-dynamic";

export default async function ProgramTermEditPage({
  params
}: {
  params: Promise<{ termId: string }>;
}) {
  const { termId } = await params;
  const term = await programRepo.getTerm(termId);
  if (!term) notFound();
  const templates = await programRepo.listTemplates(termId);

  return (
    <>
      <TopNavServer current="/programs" />
      <main className="mx-auto max-w-[900px] px-6 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-700">
              ダッシュボード
            </Link>
            <span className="mx-1">/</span>
            <Link href="/programs" className="hover:text-ink-700">
              事業内ToDo
            </Link>
            <span className="mx-1">/</span>
            <Link href={`/programs/${termId}`} className="hover:text-ink-700">
              {term.label}
            </Link>
            <span className="mx-1">/</span>
            <span>編集</span>
          </div>
          <h1 className="text-xl font-bold text-ink-900">{term.label} の編集</h1>
          <p className="text-sm text-ink-500">
            タスク列 (テンプレ) のラベル / 説明 / 並び順を編集できます
          </p>
        </header>

        <section className="liquid-surface p-5 space-y-2">
          <div className="text-xs text-ink-500 font-medium">スコープ</div>
          <div className="text-sm text-ink-700">
            事業: <span className="font-medium">{term.productCode}</span>
            {term.courseKey && (
              <>
                {" / "}コース: <span className="font-medium">{term.courseKey}</span>
              </>
            )}
            {term.cycleNo != null && (
              <>
                {" / "}期: <span className="font-medium">第{term.cycleNo}期</span>
              </>
            )}
          </div>
          <div className="text-xs text-ink-500">
            ※ スコープと対象企業の編集は今後追加予定
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">タスク列</h2>
            <Link
              href="/programs"
              className="text-xs px-3 py-1.5 rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50"
            >
              ← 事業内ToDo一覧に戻る
            </Link>
          </div>
          <TemplateEditor termId={termId} initialTemplates={templates} />
          <p className="text-[11px] text-ink-500">
            カテゴリ: {Object.values(PROGRAM_TASK_CATEGORY_LABEL).join(" / ")}
          </p>
        </section>

        {/* 危険ゾーン: 期そのものの削除 */}
        <section className="liquid-surface p-5 border border-rose-200 bg-rose-50/30 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-rose-700">この期を削除</h2>
            <p className="text-xs text-ink-500 mt-1">
              タスク列・各社の進捗 (セル) ・メモ・期日もすべて削除されます。元に戻せません。
            </p>
          </div>
          <DeleteTermButton termId={termId} termLabel={term.label} />
        </section>
      </main>
    </>
  );
}
