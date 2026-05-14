/**
 * /api/auth/gmail/callback — OAuth コールバック
 *
 * Google から code + state を受け取り、token 交換 → user_gmail_connections に保存。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  fetchUserEmail
} from "@/lib/integrations/gmail-oauth";
import {
  userRepo,
  gmailConnectionRepo,
  DEFAULT_ORG_ID
} from "@/lib/repository/server";
import { getLogger } from "@/lib/observability/logger";
import { captureException } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (await getLogger()).child({ requestId, route: "api/auth/gmail/callback" });

  const me = await userRepo.getCurrent();
  if (!me?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    log.warn({ kind: "user_denied", error }, "OAuth denied by user");
    return NextResponse.redirect(
      new URL(`/settings/gmail?error=${encodeURIComponent(error)}`, req.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings/gmail?error=missing_params", req.url));
  }
  const expectedState = req.cookies.get("gmail_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    log.warn({ kind: "state_mismatch" }, "CSRF state mismatch");
    return NextResponse.redirect(new URL("/settings/gmail?error=state_mismatch", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchUserEmail(tokens.accessToken);

    await gmailConnectionRepo.upsert({
      organizationId: me.organizationId ?? DEFAULT_ORG_ID,
      userId: me.id,
      emailAddress: email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      grantedScopes: tokens.scope
    });

    log.info({ kind: "connected", email });
    const res = NextResponse.redirect(new URL("/settings/gmail?status=connected", req.url));
    res.cookies.delete("gmail_oauth_state");
    return res;
  } catch (e) {
    log.error({
      kind: "callback_failed",
      message: (e as Error).message
    });
    captureException(e, {
      tags: { route: "api/auth/gmail/callback" },
      extra: { requestId, userId: me.id }
    });
    return NextResponse.redirect(
      new URL(`/settings/gmail?error=callback_failed`, req.url)
    );
  }
}
