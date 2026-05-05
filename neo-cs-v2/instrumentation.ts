// Next.js instrumentation hook (Next.js 16 はデフォルト有効)
// サーバー起動時に1回だけ呼ばれる。本フックで Repository 層の
// MutationHook (auditHook + loggingHook) を登録する。
//
// - auditHook  : write 後に audit_logs (Supabase) に永続化
// - loggingHook: write 後に pino で stderr/Sentry に構造化ログ

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerHook } = await import("@/lib/repository/_base");
  const { auditHook } = await import("@/lib/repository/audit");
  const { loggingHook } = await import("@/lib/observability/repo-hook");

  registerHook(auditHook);
  registerHook(loggingHook);

  // 起動ログ (loggingHook 経由ではなく直接 logger を使う — 起動完了の確認用)
  try {
    const { getLogger } = await import("@/lib/observability/logger");
    const log = await getLogger();
    log.info({ kind: "instrumentation.register" }, "registered hooks: [audit, logging]");
  } catch {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        kind: "instrumentation.register",
        message: "registered hooks: [audit, logging]"
      })
    );
  }
}
