import { describe, it, expect, beforeEach, vi } from "vitest";
import { auditHook } from "./audit";

beforeEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("auditHook", () => {
  it("MutationHookContext を audit_logs ペイロードに正規化して stderr フォールバック出力", async () => {
    // env 未設定 → service client 構築されず stderr フォールバックに進む
    let captured: string | null = null;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      captured = (chunk as Buffer | string).toString();
      return true;
    });

    await auditHook.afterWrite({
      entityType: "weekly_reviews",
      entityId: "wr-1",
      before: { good: "old" },
      after: { good: "new" },
      action: "update",
      ctx: {
        actor: { userId: "u-1", email: "u@x", role: "admin", organizationId: "org-1" },
        request: { id: "req-1", ip: "10.0.0.1", userAgent: "ua" }
      }
    });

    expect(captured).not.toBeNull();
    const parsed = JSON.parse(captured!);
    expect(parsed.kind).toBe("audit_fallback");
    expect(parsed.entry.action).toBe("update");
    expect(parsed.entry.targetTable).toBe("weekly_reviews");
    expect(parsed.entry.targetId).toBe("wr-1");
    expect(parsed.entry.actor.userId).toBe("u-1");
    expect(parsed.entry.request.id).toBe("req-1");
  });

  it("source デフォルトは 'app'", async () => {
    let captured: string | null = null;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      captured = (chunk as Buffer | string).toString();
      return true;
    });

    await auditHook.afterWrite({
      entityType: "x",
      entityId: "1",
      action: "create",
      ctx: {
        actor: { userId: "u", email: null, role: "member", organizationId: null },
        request: { id: "r", ip: null, userAgent: null }
      }
    });
    const parsed = JSON.parse(captured!);
    expect(parsed.entry.source).toBe("app");
  });
});
