import { describe, it, expect } from "vitest";
import { checkSessionLimits, SESSION_IDLE_MAX_MS, SESSION_ABS_MAX_MS } from "./session";

const NOW = 1_700_000_000_000;

describe("checkSessionLimits", () => {
  it("loginAt も lastSeenAt も新しければ ok", () => {
    expect(checkSessionLimits({ loginAt: NOW - 1000, lastSeenAt: NOW - 1000 }, NOW)).toEqual({
      ok: true
    });
  });

  it("idle 超過で idle_timeout", () => {
    expect(
      checkSessionLimits(
        { loginAt: NOW - 1_000, lastSeenAt: NOW - SESSION_IDLE_MAX_MS - 1 },
        NOW
      )
    ).toEqual({ ok: false, reason: "idle_timeout" });
  });

  it("absolute 超過で absolute_timeout", () => {
    expect(
      checkSessionLimits(
        { loginAt: NOW - SESSION_ABS_MAX_MS - 1, lastSeenAt: NOW - 1_000 },
        NOW
      )
    ).toEqual({ ok: false, reason: "absolute_timeout" });
  });

  it("idle が absolute より先に判定される (idle 優先)", () => {
    // 両方超過 → idle_timeout が返るべき
    expect(
      checkSessionLimits(
        { loginAt: NOW - SESSION_ABS_MAX_MS - 1, lastSeenAt: NOW - SESSION_IDLE_MAX_MS - 1 },
        NOW
      ).ok
    ).toBe(false);
  });

  it("境界値: idle ぴったりは ok", () => {
    expect(
      checkSessionLimits(
        { loginAt: NOW - 1_000, lastSeenAt: NOW - SESSION_IDLE_MAX_MS },
        NOW
      ).ok
    ).toBe(true);
  });
});
