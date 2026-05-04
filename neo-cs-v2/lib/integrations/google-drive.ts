/**
 * Google Drive 連携 (server-only)
 *
 * 用途:
 *   - 営業 (neo-sales) → CS 引継ぎ時に、テンプレフォルダを共有ドライブ配下に
 *     複製して顧客個別フォルダを生成する
 *   - フォルダURLを Supabase に保存して /companies/[id] や /sales-handoff/[id]
 *     からワンクリックで開けるようにする
 *
 * 認証:
 *   - サービスアカウント JWT (env: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)
 *   - スコープは https://www.googleapis.com/auth/drive (フォルダ複製のため drive.file では不足)
 *
 * 共有ドライブ (TeamDrive):
 *   - supportsAllDrives:true / includeItemsFromAllDrives:true 必須
 *
 * フォールバック:
 *   - env が未設定なら configured()=false。呼び出し側はno-opとして扱う想定
 *
 * 失敗時:
 *   - 構造化エラー DriveIntegrationError を throw
 *   - 5xx/429/ネットワーク系は最大3回 (指数バックオフ) で自動リトライ
 *   - 4xx (権限/不存在) は即時 throw
 */

import "server-only";
import { buildFolderName } from "./drive-naming";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

export interface DriveConfig {
  sharedDriveId: string;
  customerParentFolderId: string;
  templateFolderId: string;
  serviceAccountEmail: string;
  serviceAccountJson: string;
}

export class DriveIntegrationError extends Error {
  code:
    | "not_configured"
    | "auth_failed"
    | "template_not_found"
    | "permission_denied"
    | "duplicate"
    | "api_error"
    | "unknown";
  status?: number;
  cause?: unknown;
  constructor(
    code: DriveIntegrationError["code"],
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "DriveIntegrationError";
    this.code = code;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

export function readDriveConfig(): DriveConfig | null {
  const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID;
  const customerParentFolderId = process.env.GOOGLE_DRIVE_CUSTOMER_PARENT_FOLDER_ID;
  const templateFolderId = process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
  const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  if (
    !sharedDriveId ||
    !customerParentFolderId ||
    !templateFolderId ||
    !serviceAccountEmail ||
    !serviceAccountJson
  ) {
    return null;
  }
  return {
    sharedDriveId,
    customerParentFolderId,
    templateFolderId,
    serviceAccountEmail,
    serviceAccountJson,
  };
}

export function configured(): boolean {
  return readDriveConfig() !== null;
}

export function getFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

// ─────────────────────────────────────────────────────────────
// Drive API クライアント
// ─────────────────────────────────────────────────────────────

// drive_v3.Drive 型に相当する最小限のシェイプ。googleapis 型を直接 import すると
// バンドラ警告が出るため、本ファイル内ではローカル alias を使う。
type DriveApi = {
  files: {
    get(params: Record<string, unknown>): Promise<{ data: DriveFile }>;
    list(params: Record<string, unknown>): Promise<{ data: { files?: DriveFile[] } }>;
    create(params: Record<string, unknown>): Promise<{ data: DriveFile }>;
    copy(params: Record<string, unknown>): Promise<{ data: DriveFile }>;
  };
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
}

let cachedClient: DriveApi | null = null;

export async function createDriveClient(): Promise<DriveApi> {
  if (cachedClient) return cachedClient;
  const cfg = readDriveConfig();
  if (!cfg) throw new DriveIntegrationError("not_configured", "Google Drive env not configured");

  // 静的import: bundler に google パッケージを含めさせる
  // (optionalImport の new Function 経由だと Vercel build が googleapis を bundle せず
  //  ランタイムで「Cannot find module」になり Drive 連携が無音失敗する)
  const { google } = await import("googleapis");

  let creds: { client_email: string; private_key: string };
  try {
    creds = JSON.parse(cfg.serviceAccountJson);
  } catch (e) {
    throw new DriveIntegrationError("auth_failed", "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON", {
      cause: e,
    });
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: DRIVE_SCOPES,
  });

  cachedClient = google.drive({ version: "v3", auth }) as unknown as DriveApi;
  return cachedClient;
}

/** テスト用: createDriveClient のキャッシュ / 注入差し替え */
export function __setDriveClientForTest(client: DriveApi | null): void {
  cachedClient = client;
}

// ─────────────────────────────────────────────────────────────
// リトライ
// ─────────────────────────────────────────────────────────────

interface ApiHttpError {
  code?: number;
  status?: number;
  message?: string;
  errors?: Array<{ reason?: string; message?: string }>;
}

function getErrorStatus(e: unknown): number | undefined {
  const ex = e as ApiHttpError | undefined;
  return ex?.code ?? ex?.status;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = getErrorStatus(e);
      const transient =
        status === undefined ||
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600);
      if (!transient || i >= attempts) {
        throw classifyError(e, label);
      }
      const wait = 200 * Math.pow(2, i - 1) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw classifyError(lastErr, label);
}

function classifyError(e: unknown, label: string): DriveIntegrationError {
  if (e instanceof DriveIntegrationError) return e;
  const status = getErrorStatus(e);
  const msg = (e as { message?: string }).message ?? "unknown";
  if (status === 401 || status === 403) {
    return new DriveIntegrationError("permission_denied", `${label}: ${msg}`, { status, cause: e });
  }
  if (status === 404) {
    return new DriveIntegrationError("template_not_found", `${label}: ${msg}`, { status, cause: e });
  }
  return new DriveIntegrationError("api_error", `${label}: ${msg}`, { status, cause: e });
}

// ─────────────────────────────────────────────────────────────
// 公開API
// ─────────────────────────────────────────────────────────────

export interface ListFoldersOptions {
  /** 名前完全一致検索 */
  exactName?: string;
}

/**
 * 親フォルダ配下のフォルダ一覧 (共有ドライブ対応)
 */
export async function listFolders(
  parentId: string,
  options?: ListFoldersOptions,
): Promise<DriveFile[]> {
  const cfg = readDriveConfig();
  if (!cfg) throw new DriveIntegrationError("not_configured", "Google Drive env not configured");
  const drive = await createDriveClient();

  const qParts = [
    `'${parentId}' in parents`,
    `mimeType='${FOLDER_MIME}'`,
    "trashed=false",
  ];
  if (options?.exactName) {
    qParts.push(`name='${options.exactName.replace(/'/g, "\\'")}'`);
  }

  return withRetry("listFolders", async () => {
    const res = await drive.files.list({
      q: qParts.join(" and "),
      corpora: "allDrives",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: "files(id,name,mimeType,parents,webViewLink)",
      pageSize: 100,
    });
    return res.data.files ?? [];
  });
}

export interface CopyTemplateInput {
  companyName: string;
  /** 省略時は今日。ISO datetime 可 */
  date?: string;
}

export interface CopyTemplateResult {
  folderId: string;
  folderName: string;
  url: string;
  /** 同名フォルダがすでにあったので作成せず再利用したケース */
  reused: boolean;
}

/**
 * テンプレフォルダを CUSTOMER_PARENT 直下に複製。
 *  - 同名 (date+companyName) フォルダがあれば再利用 (重複防止)
 *  - Drive API は folder copy 非対応のため、フォルダを再帰的に作り直し+ファイル copy
 */
export async function copyTemplateFolder(
  input: CopyTemplateInput,
): Promise<CopyTemplateResult> {
  const cfg = readDriveConfig();
  if (!cfg) throw new DriveIntegrationError("not_configured", "Google Drive env not configured");

  const folderName = buildFolderName({ companyName: input.companyName, date: input.date });

  // 重複チェック
  const existing = await listFolders(cfg.customerParentFolderId, { exactName: folderName });
  if (existing.length > 0) {
    return {
      folderId: existing[0].id,
      folderName,
      url: getFolderUrl(existing[0].id),
      reused: true,
    };
  }

  const newFolder = await cloneFolderRecursive(
    cfg.templateFolderId,
    cfg.customerParentFolderId,
    folderName,
  );
  return {
    folderId: newFolder.id,
    folderName,
    url: getFolderUrl(newFolder.id),
    reused: false,
  };
}

/**
 * フォルダを再帰的にコピー。
 *   - 新フォルダを parent 配下に作成 (renameTo がある場合はその名前)
 *   - source 配下の各 child について
 *       folder → 再帰
 *       file   → drive.files.copy() で新フォルダ配下に複製
 *
 * 共有ドライブ全段で supportsAllDrives:true を付与。
 * 大量ネスト・大規模テンプレでは時間がかかるため呼び出し側はタイムアウトに注意。
 */
export async function cloneFolderRecursive(
  sourceFolderId: string,
  destParentId: string,
  renameTo?: string,
): Promise<DriveFile> {
  const cfg = readDriveConfig();
  if (!cfg) throw new DriveIntegrationError("not_configured", "Google Drive env not configured");
  const drive = await createDriveClient();

  // source の名前を取得 (renameTo 未指定時に使用)
  const srcName =
    renameTo ??
    (await withRetry("get(source)", async () => {
      const res = await drive.files.get({
        fileId: sourceFolderId,
        fields: "id,name,mimeType",
        supportsAllDrives: true,
      });
      if (res.data.mimeType !== FOLDER_MIME) {
        throw new DriveIntegrationError(
          "api_error",
          `cloneFolderRecursive: source is not a folder: ${sourceFolderId}`,
        );
      }
      return res.data.name;
    }));

  // 新フォルダを作成
  const created = await withRetry("create(folder)", async () => {
    const res = await drive.files.create({
      requestBody: {
        name: srcName,
        mimeType: FOLDER_MIME,
        parents: [destParentId],
      },
      supportsAllDrives: true,
      fields: "id,name,mimeType,parents,webViewLink",
    });
    return res.data;
  });

  // 配下の child を列挙して再帰 / コピー
  const children = await withRetry("list(children)", async () => {
    const res = await drive.files.list({
      q: `'${sourceFolderId}' in parents and trashed=false`,
      corpora: "allDrives",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: "files(id,name,mimeType)",
      pageSize: 1000,
    });
    return res.data.files ?? [];
  });

  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      await cloneFolderRecursive(child.id, created.id);
    } else {
      await withRetry("copy(file)", async () => {
        await drive.files.copy({
          fileId: child.id,
          requestBody: { parents: [created.id], name: child.name },
          supportsAllDrives: true,
          fields: "id",
        });
      });
    }
  }

  return created;
}
