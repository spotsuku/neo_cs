// 権限判定: グローバルロール × 事業スコープロール × 表示モード
//
// 設計原則:
//   - 副作用なし。Repository を取らない（呼び出し側で取得した data を渡す）
//   - サーバ／クライアント両方で同じ判定が回るよう、純関数で構成
//   - 真のガードはサーバ側（Server Action / RLS）。本モジュールは UI 出し分けと一次防衛
//
// 用語:
//   - actor          : 現在のユーザー（AppUser）
//   - programs       : actor が担当する事業（productCode）とそのスコープロール一覧
//   - companyAccess  : external ユーザー専用。閲覧可能な companyId のセット
//   - effectiveRole  : admin が UI トグルで「manager / member の見え方」を切り替えた結果のロール
//
// マネージャー専用画面の判定は canSeeManagerView() を使うこと。

import type {
  AppUser,
  AppUserRole,
  ProgramScopeRole,
  UserProgramRole,
  UserCompanyAccess
} from "@/lib/repository/types";

// ─────────────────────────────────────────────
// PermissionContext: 1 リクエスト分の権限判定材料
// ─────────────────────────────────────────────
export type PermissionContext = {
  actor: AppUser | null;
  /** actor が担当する事業 + スコープロール。admin は空配列でよい（暗黙的に全事業 template_editor 相当） */
  programs: UserProgramRole[];
  /** external ユーザー専用。閲覧可能 companyId */
  companyAccess: UserCompanyAccess[];
  /** admin が UI トグルで切り替えた表示モード。未指定なら本来のロール */
  viewModeOverride?: "manager" | "member";
};

// ─────────────────────────────────────────────
// effectiveRole: 実際の振る舞いに使うロール
// ─────────────────────────────────────────────
export function effectiveRole(ctx: PermissionContext): AppUserRole {
  const r = ctx.actor?.role;
  if (!r) return "viewer";
  // admin のみ表示モードの切替を許可。manager/member/external は固定
  if (r === "admin" && ctx.viewModeOverride) return ctx.viewModeOverride;
  return r;
}

// ─────────────────────────────────────────────
// 事業（productCode）に対するスコープロール解決
// ─────────────────────────────────────────────
export function programScopeRole(
  ctx: PermissionContext,
  productCode: string
): ProgramScopeRole | null {
  const r = ctx.actor?.role;
  if (!r) return null;
  // admin は常に template_editor 相当
  if (r === "admin") return "template_editor";
  const found = ctx.programs.find((p) => p.productCode === productCode);
  return found?.scopeRole ?? null;
}

/** actor が担当している事業 productCode 一覧（admin は呼び出し側で products 全量を渡す想定） */
export function assignedProductCodes(ctx: PermissionContext): string[] {
  if (ctx.actor?.role === "admin") {
    // admin は呼び出し側で全 productCode を渡してフィルタ不要
    return ctx.programs.map((p) => p.productCode);
  }
  return ctx.programs.map((p) => p.productCode);
}

// ─────────────────────────────────────────────
// 画面・機能ごとの判定
// ─────────────────────────────────────────────

/** マネージャー専用画面（事業全体進捗・アラート・契約更新サマリー）を見られるか */
export function canSeeManagerView(ctx: PermissionContext): boolean {
  const er = effectiveRole(ctx);
  return er === "admin" || er === "manager";
}

/** 担当事業の進捗系画面（programs / weekly / renewal 等）を見られるか */
export function canViewProgram(ctx: PermissionContext, productCode: string): boolean {
  if (ctx.actor?.role === "admin") return true;
  if (ctx.actor?.role === "external") return false; // external は事業横断画面を見ない
  return programScopeRole(ctx, productCode) != null;
}

/** 進捗・週次など「項目編集」を行えるか */
export function canEditProgress(ctx: PermissionContext, productCode: string): boolean {
  if (ctx.actor?.role === "admin") return true;
  const sr = programScopeRole(ctx, productCode);
  return sr === "editor" || sr === "template_editor";
}

/** 列名・テンプレート編集など「事業内テンプレ編集」を行えるか */
export function canEditProgramTemplate(ctx: PermissionContext, productCode: string): boolean {
  if (ctx.actor?.role === "admin") return true;
  return programScopeRole(ctx, productCode) === "template_editor";
}

/**
 * NEO 全体に関わる設定（事業の作成削除、全社共通マスタ、ユーザー管理など）を変更できるか
 * → admin のみ
 */
export function canEditGlobalSettings(ctx: PermissionContext): boolean {
  return ctx.actor?.role === "admin";
}

/** ユーザー追加・削除・ロール変更 */
export function canManageUsers(ctx: PermissionContext): boolean {
  return ctx.actor?.role === "admin";
}

// ─────────────────────────────────────────────
// 企業単位のアクセス
// ─────────────────────────────────────────────

/**
 * 企業ページを開けるか
 * - admin/manager/member: 企業一覧は事業横断で閲覧可（進捗系タブの可否は別途 canEditProgress 等で判定）
 * - external: user_company_access に登録された企業のみ
 */
export function canViewCompany(ctx: PermissionContext, companyId: string): boolean {
  const r = ctx.actor?.role;
  if (!r) return false;
  if (r === "admin" || r === "manager" || r === "member" || r === "viewer") return true;
  if (r === "external") {
    return ctx.companyAccess.some((a) => a.companyId === companyId);
  }
  return false;
}

/**
 * 企業ページ内で「進捗系タブ」を表示するか
 * その企業がどの事業の契約かは呼び出し側で解決した上で本関数を呼ぶ
 */
export function canSeeCompanyProgressTabs(
  ctx: PermissionContext,
  args: { companyId: string; productCodes: string[] }
): boolean {
  const r = ctx.actor?.role;
  if (!r) return false;
  if (r === "admin") return true;
  if (r === "external") {
    return canViewCompany(ctx, args.companyId);
  }
  // manager / member: いずれかの担当事業に該当する契約があるか
  return args.productCodes.some((pc) => canViewProgram(ctx, pc));
}

// ─────────────────────────────────────────────
// 表示モード（admin 専用トグル）の永続化キー
// localStorage で持つだけ。サーバ判定にはクッキー経由で渡す想定
// ─────────────────────────────────────────────
export const VIEW_MODE_STORAGE_KEY = "neo_cs:view_mode";
export const VIEW_MODE_COOKIE = "neo_cs_view_mode";

export function isViewModeOverride(value: unknown): value is "manager" | "member" {
  return value === "manager" || value === "member";
}

// ─────────────────────────────────────────────
// インパーソン (admin が任意ユーザー視点で巡回確認するための仕組み)
// ─────────────────────────────────────────────
// 設計:
//   - サーバ側 cookie `neo_cs_impersonate` に対象 user_id を保存
//   - getPermissionContext() が admin かつ cookie 在ったら actor を差替える
//   - audit_logs には常に「実 admin が代理操作した」旨を記録する（運用ルール）
//   - external のインパーソンは禁止（情報漏洩リスク回避）
// 真のセキュリティ境界は RLS。本機能は UI 確認用であり、書込みは
// 元 admin として実行される（service_role 経由のため）点に注意。
export const IMPERSONATE_COOKIE = "neo_cs_impersonate";
