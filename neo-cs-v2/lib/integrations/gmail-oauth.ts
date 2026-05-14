// Gmail OAuth ヘルパ
//
// 各 CS メンバーが /settings/gmail から「接続」ボタンを押した際の OAuth フロー。
// Google OAuth 2.0 Authorization Code フロー (offline access) を実装。
//
// 前提環境変数:
//   - GOOGLE_CLIENT_ID
//   - GOOGLE_CLIENT_SECRET
//   - NEXT_PUBLIC_APP_BASE_URL (callback URL の組立に使用)
//
// Google Cloud Console 側で redirect URI を登録する必要あり:
//   ${NEXT_PUBLIC_APP_BASE_URL}/api/auth/gmail/callback

import "server-only";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

export function getGmailScopes(): string[] {
  return [...GMAIL_SCOPES];
}

function getRedirectUri(): string {
  // .trim() で env 値の末尾改行・空白事故を防ぐ (過去に \n 混入の事故あり)
  const base = (process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:3000").trim();
  return `${base.replace(/\/$/, "")}/api/auth/gmail/callback`;
}

export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    // 既に承認済みでも必ず refresh_token を再発行
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type TokenExchangeResult = {
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  scope: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth env not configured");

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code"
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token_exchange_failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token: string;
    expires_in: number;
    scope: string;
  };
  if (!json.refresh_token) {
    throw new Error(
      "refresh_token missing; ensure prompt=consent&access_type=offline and the OAuth client allows it"
    );
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    accessTokenExpiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    scope: json.scope
  };
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`userinfo_failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { email?: string };
  if (!json.email) throw new Error("email_missing_from_userinfo");
  return json.email;
}

/** access_token 期限切れ時に refresh_token から新しい access_token を取得 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  accessTokenExpiresAt: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth env not configured");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`refresh_failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    accessTokenExpiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString()
  };
}
