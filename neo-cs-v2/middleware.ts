// Page Route 用 認証 / ロールガード / セッション制限 middleware
//
// 役割:
//  1. Supabase Auth の Cookie セッションを refresh し、未ログインなら /login へ
//  2. パスごとのロール要件 (admin / manager / member) を強制
//  3. lib/security/session.ts の idle 30min / abs 8h を適用
//  4. 認可済みリクエストには下流の Server Components / Server Actions が
//     actor を読めるよう x-app-user-* ヘッダを付与
//
// API Route の認証は lib/security/auth.ts の verifyBearer (Bearer JWT) が担当。
// 両者は併存し、middleware は Page Route 専用、auth.ts は API Route 専用。
//
// runtime: 'nodejs' を強制している。理由:
//   - @supabase/ssr が Node API を一部使用
//   - lib/security/session.ts も Node ランタイムを前提
// (Next.js 16 は middleware の nodejs runtime をサポート)

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMiddlewareSupabaseClient } from "@/lib/supabase/middleware";
import {
  SESSION_IDLE_MAX_MS,
  SESSION_ABS_MAX_MS
} from "@/lib/security/session";

export const config = {
  // すべての Page Route と /api/admin/* に適用。静的アセット・Next 内部・
  // 認証エンドポイント自体は除外。
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)"
  ]
};

export const runtime = "nodejs";

// ─────────────────────────────────────────────
// 認可ルール
// ─────────────────────────────────────────────
type Role = "admin" | "manager" | "member" | "viewer";

const ROLE_ORDER: Record<Role, number> = {
  viewer: 0,
  member: 1,
  manager: 2,
  admin: 3
};

function hasRole(actual: Role | undefined, min: Role): boolean {
  if (!actual) return false;
  return ROLE_ORDER[actual] >= ROLE_ORDER[min];
}

/**
 * パスから必要ロールを返す。null = 認証済みなら通す (viewer 以上)。
 * 未マッチ = 認証必須 (= viewer 以上)。
 */
function requiredRoleFor(pathname: string): Role | null {
  // admin 専用
  if (pathname.startsWith("/settings/users")) return "admin";
  if (pathname.startsWith("/api/admin")) return "admin";
  if (pathname.startsWith("/settings/consents")) return "admin";
  if (pathname.startsWith("/settings/demo-data")) return "admin";
  // manager 以上
  if (pathname.startsWith("/team")) return "manager";
  if (pathname.startsWith("/reports")) return "manager";
  // member 以上 (CS 業務全般)
  if (pathname.startsWith("/companies")) return "member";
  if (pathname.startsWith("/weekly")) return "member";
  if (pathname.startsWith("/onboarding")) return "member";
  if (pathname.startsWith("/renewal")) return "member";
  if (pathname.startsWith("/attendance")) return "member";
  if (pathname.startsWith("/inbox")) return "member";
  if (pathname.startsWith("/surveys")) return "member";
  // 個人画面 (me / profile / notifications) は viewer 以上で OK
  return null;
}

// ─────────────────────────────────────────────
// セッション cookie (idle/absolute 計測)
// ─────────────────────────────────────────────
const SESSION_META_COOKIE = "neo-cs-session-meta";

type SessionMeta = { loginAt: number; lastSeenAt: number };

function readSessionMeta(req: NextRequest): SessionMeta | null {
  const raw = req.cookies.get(SESSION_META_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionMeta;
    if (typeof parsed.loginAt === "number" && typeof parsed.lastSeenAt === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSessionMeta(res: NextResponse, meta: SessionMeta): void {
  res.cookies.set({
    name: SESSION_META_COOKIE,
    value: encodeURIComponent(JSON.stringify(meta)),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_ABS_MAX_MS / 1000)
  });
}

function clearAllAuthCookies(res: NextResponse, names: string[]): void {
  for (const n of names) res.cookies.delete(n);
  res.cookies.delete(SESSION_META_COOKIE);
}

// ─────────────────────────────────────────────
// 公開パス (認証不要)
// ─────────────────────────────────────────────
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth", // /api/auth/* (callback / signout)
  "/api/health",
  "/api/cron", // Vercel Cron からの Bearer 認証 (各 route 内で verifyBearer)
  "/api/integrations", // 外部システム連携の Bearer 認証 (handoff / drive retry 等)
  "/api/claude", // 内部呼出 + Bearer 認証
  "/styleguide" // 静的なデザイン参照ページ
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ─────────────────────────────────────────────
// ハンドラ本体
// ─────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. 公開パスは素通し
  if (isPublic(pathname)) return NextResponse.next();

  // 2. mock モードは middleware を素通し (ローカル開発)
  if ((process.env.REPO_DRIVER ?? "mock") !== "supabase") {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // 3. Supabase Auth セッション refresh
  const supabase = getMiddlewareSupabaseClient(req, res);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(req, "unauthenticated");
  }

  // 4. セッション制限 (idle / absolute)
  const now = Date.now();
  const meta = readSessionMeta(req) ?? { loginAt: now, lastSeenAt: now };
  if (now - meta.lastSeenAt > SESSION_IDLE_MAX_MS) {
    return signOutAndRedirect(req, "idle_timeout");
  }
  if (now - meta.loginAt > SESSION_ABS_MAX_MS) {
    return signOutAndRedirect(req, "absolute_timeout");
  }
  meta.lastSeenAt = now;
  writeSessionMeta(res, meta);

  // 5. app_users から role / organization_id / is_active を取得
  //    RLS は service_role でバイパス。理由: middleware はユーザー存在判定のみで
  //    機微情報は返さない。anon-key + RLS だと auth.uid() の解決タイミング次第で
  //    自分のレコードが見えないケースがあり、user_disabled の誤判定が発生するため。
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return signOutAndRedirect(req, "user_disabled");
  }
  const sbAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: row } = await sbAdmin
    .from("app_users")
    .select("id, role, organization_id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!row || row.is_active === false) {
    return signOutAndRedirect(req, "user_disabled");
  }

  const role = (row.role ?? "member") as Role;

  // 6. パスごとの最低ロール要件をチェック
  const required = requiredRoleFor(pathname);
  if (required && !hasRole(role, required)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("forbidden", "1");
    return NextResponse.redirect(url);
  }

  // 7. 下流 (Server Component / Server Action) が actor を読めるようヘッダ付与。
  //    lib/repository/supabase/_actor.ts の AsyncLocalStorage と接続するための
  //    ヘルパは lib/security/actor-from-headers.ts (本セッションで新設)
  res.headers.set("x-app-user-id", row.id);
  res.headers.set("x-app-user-role", role);
  if (row.organization_id) res.headers.set("x-app-org-id", row.organization_id);
  if (user.email) res.headers.set("x-app-user-email", user.email);

  return res;
}

function redirectToLogin(req: NextRequest, reason: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

function signOutAndRedirect(req: NextRequest, reason: string) {
  const res = redirectToLogin(req, reason);
  clearAllAuthCookies(res, [
    "sb-access-token",
    "sb-refresh-token",
    // Supabase ssr が動的に生成する project ref 別の cookie 名はここで網羅できないが、
    // 主要 2 種を消すことで実質的にセッション無効化される (refresh 失敗で signOut 状態へ)
    SESSION_META_COOKIE
  ]);
  return res;
}
