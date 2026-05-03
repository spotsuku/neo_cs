import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerHook, runAfterWrite, clearHooksForTesting } from "./_base";
import type { MutationHook } from "./audit";

beforeEach(() => clearHooksForTesting());

const mkCtx = () => ({
  actor: { userId: "u1", email: "u@x", role: "member", organizationId: "org1" },
  request: { id: "req-1", ip: "127.0.0.1", userAgent: "test" }
});

describe("registerHook", () => {
  it("同一インスタンス2回登録しても 1 回だけ呼ばれる (冪等)", async () => {
    const fn = vi.fn();
    const hook: MutationHook = { afterWrite: fn };
    registerHook(hook);
    registerHook(hook);
    await runAfterWrite({
      entityType: "x",
      entityId: "1",
      action: "create",
      ctx: mkCtx()
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("別インスタンスは独立して登録される", async () => {
    const a = vi.fn();
    const b = vi.fn();
    registerHook({ afterWrite: a });
    registerHook({ afterWrite: b });
    await runAfterWrite({
      entityType: "x",
      entityId: "1",
      action: "create",
      ctx: mkCtx()
    });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});

describe("runAfterWrite — 失敗耐性", () => {
  it("hookが例外を投げても他のhookは呼ばれ、呼び元には伝播しない", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const ok = vi.fn();
    registerHook({
      afterWrite: () => {
        throw new Error("hook crashed");
      }
    });
    registerHook({ afterWrite: ok });
    await expect(
      runAfterWrite({ entityType: "x", entityId: "1", action: "update", ctx: mkCtx() })
    ).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalledOnce();
  });

  it("ctx の actor / request / before / after を hook に正しく伝達", async () => {
    let captured: unknown;
    registerHook({
      afterWrite: async (args) => {
        captured = args;
      }
    });
    const ctx = mkCtx();
    await runAfterWrite({
      entityType: "company",
      entityId: "co-1",
      before: { name: "old" },
      after: { name: "new" },
      action: "update",
      ctx
    });
    expect(captured).toMatchObject({
      entityType: "company",
      entityId: "co-1",
      before: { name: "old" },
      after: { name: "new" },
      action: "update",
      ctx: { actor: { userId: "u1" } }
    });
  });
});
