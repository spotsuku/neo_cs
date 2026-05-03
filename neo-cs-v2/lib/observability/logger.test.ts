import { describe, it, expect, vi, afterEach } from "vitest";
import { isNoiseKind, getLogger } from "./logger";

afterEach(() => vi.restoreAllMocks());

describe("isNoiseKind", () => {
  it("middleware の app_users SELECT 等は noise 判定", () => {
    expect(isNoiseKind("select_app_users_for_session")).toBe(true);
    expect(isNoiseKind("middleware.session_refresh")).toBe(true);
    expect(isNoiseKind("middleware.role_lookup")).toBe(true);
    expect(isNoiseKind("supabase.auth.refresh")).toBe(true);
  });

  it("通常 kind は false", () => {
    expect(isNoiseKind("repo.write")).toBe(false);
    expect(isNoiseKind("claude.call")).toBe(false);
    expect(isNoiseKind(undefined)).toBe(false);
    expect(isNoiseKind(123)).toBe(false);
  });
});

describe("logger fallback noise 降格", () => {
  it("noise kind を info で投げても LOG_LEVEL=info では出力されない", async () => {
    const orig = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "info";
    let written = "";
    vi.spyOn(process.stderr, "write").mockImplementation((c) => {
      written += (c as Buffer | string).toString();
      return true;
    });
    // logger は singleton キャッシュなので vi.resetModules で再 import
    vi.resetModules();
    const { getLogger: gl } = await import("./logger");
    const log = await gl();
    log.info({ kind: "select_app_users_for_session", userId: "u1" }, "noise");
    log.info({ kind: "repo.write", entityType: "x" }, "real");

    expect(written).not.toContain("select_app_users_for_session");
    expect(written).toContain("repo.write");

    process.env.LOG_LEVEL = orig;
  });
});
