/**
 * google-drive.ts のテスト
 *
 * googleapis を実際には叩けないため、createDriveClient のキャッシュを
 * __setDriveClientForTest で差し替えてモック動作を検証する。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __setDriveClientForTest,
  copyTemplateFolder,
  listFolders,
  getFolderUrl,
  DriveIntegrationError,
  configured,
} from "./google-drive";

const ENV = {
  GOOGLE_DRIVE_SHARED_DRIVE_ID: "shared-drive-1",
  GOOGLE_DRIVE_CUSTOMER_PARENT_FOLDER_ID: "parent-1",
  GOOGLE_DRIVE_TEMPLATE_FOLDER_ID: "tpl-1",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL: "bot@example.iam.gserviceaccount.com",
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: "bot@example.iam.gserviceaccount.com",
    private_key: "PRIVATE",
  }),
};

function setEnv() {
  for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
}
function unsetEnv() {
  for (const k of Object.keys(ENV)) delete process.env[k];
}

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

function buildFakeDrive(initial: Record<string, FakeFile[]>) {
  // フォルダID → 配下 ファイル/フォルダ のメモ
  const tree: Record<string, FakeFile[]> = JSON.parse(JSON.stringify(initial));
  let counter = 1;
  const allFiles: Record<string, FakeFile> = {};
  for (const list of Object.values(tree)) {
    for (const f of list) allFiles[f.id] = f;
  }
  const calls = {
    create: vi.fn(),
    copy: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  };
  const drive = {
    files: {
      get: async (params: { fileId: string }) => {
        calls.get(params);
        const f = allFiles[params.fileId];
        if (!f) throw Object.assign(new Error("not found"), { code: 404 });
        return { data: f };
      },
      list: async (params: { q: string }) => {
        calls.list(params);
        const m = /'([^']+)' in parents/.exec(params.q);
        const parent = m?.[1];
        let files = parent ? tree[parent] ?? [] : [];
        const nameMatch = /name='([^']+)'/.exec(params.q);
        if (nameMatch) files = files.filter((f) => f.name === nameMatch[1]);
        const folderOnly = /mimeType='application\/vnd\.google-apps\.folder'/.test(params.q);
        if (folderOnly) files = files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
        return { data: { files } };
      },
      create: async (params: { requestBody: { name: string; mimeType: string; parents?: string[] } }) => {
        calls.create(params);
        const id = `new-${counter++}`;
        const file: FakeFile = {
          id,
          name: params.requestBody.name,
          mimeType: params.requestBody.mimeType,
          parents: params.requestBody.parents,
        };
        allFiles[id] = file;
        const parent = params.requestBody.parents?.[0];
        if (parent) {
          tree[parent] = tree[parent] ?? [];
          tree[parent].push(file);
        }
        if (file.mimeType === "application/vnd.google-apps.folder") {
          tree[id] = [];
        }
        return { data: file };
      },
      copy: async (params: { fileId: string; requestBody: { parents?: string[]; name?: string } }) => {
        calls.copy(params);
        const src = allFiles[params.fileId];
        if (!src) throw Object.assign(new Error("not found"), { code: 404 });
        const id = `copy-${counter++}`;
        const file: FakeFile = {
          id,
          name: params.requestBody.name ?? src.name,
          mimeType: src.mimeType,
          parents: params.requestBody.parents,
        };
        allFiles[id] = file;
        const parent = params.requestBody.parents?.[0];
        if (parent) {
          tree[parent] = tree[parent] ?? [];
          tree[parent].push(file);
        }
        return { data: file };
      },
    },
  };
  return { drive, calls, tree };
}

describe("google-drive", () => {
  beforeEach(() => {
    setEnv();
    __setDriveClientForTest(null);
  });

  it("getFolderUrl は webViewLink 風URLを返す", () => {
    expect(getFolderUrl("abc")).toBe("https://drive.google.com/drive/folders/abc");
  });

  it("env未設定時 configured()=false", () => {
    unsetEnv();
    expect(configured()).toBe(false);
  });

  it("env未設定時 copyTemplateFolder は not_configured エラー", async () => {
    unsetEnv();
    await expect(copyTemplateFolder({ companyName: "x" })).rejects.toMatchObject({
      code: "not_configured",
    });
  });

  it("listFolders は親配下を共有ドライブクエリで取得", async () => {
    const fake = buildFakeDrive({
      "parent-1": [
        { id: "f1", name: "[2026-05-04] イオン九州", mimeType: "application/vnd.google-apps.folder" },
        { id: "f2", name: "other", mimeType: "application/vnd.google-apps.folder" },
      ],
    });
    __setDriveClientForTest(fake.drive as never);
    const list = await listFolders("parent-1");
    expect(list).toHaveLength(2);
    expect(fake.calls.list).toHaveBeenCalledOnce();
    const q = fake.calls.list.mock.calls[0][0].q;
    expect(q).toContain("'parent-1' in parents");
    expect(q).toContain("mimeType='application/vnd.google-apps.folder'");
  });

  it("copyTemplateFolder: 同名フォルダがあれば再利用 (reused=true)", async () => {
    const fake = buildFakeDrive({
      "parent-1": [
        {
          id: "existing-1",
          name: "[2026-05-04] イオン九州",
          mimeType: "application/vnd.google-apps.folder",
        },
      ],
      "tpl-1": [],
    });
    __setDriveClientForTest(fake.drive as never);
    const out = await copyTemplateFolder({ companyName: "イオン九州", date: "2026-05-04" });
    expect(out.reused).toBe(true);
    expect(out.folderId).toBe("existing-1");
    expect(out.url).toContain("existing-1");
    expect(fake.calls.create).not.toHaveBeenCalled();
  });

  it("copyTemplateFolder: 新規作成し、テンプレ配下を再帰コピーする", async () => {
    const fake = buildFakeDrive({
      "parent-1": [],
      "tpl-1": [
        { id: "tpl-file1", name: "README", mimeType: "text/plain" },
        { id: "tpl-sub", name: "sub", mimeType: "application/vnd.google-apps.folder" },
      ],
      "tpl-sub": [
        { id: "tpl-file2", name: "inner.txt", mimeType: "text/plain" },
      ],
    });
    __setDriveClientForTest(fake.drive as never);
    const out = await copyTemplateFolder({ companyName: "Acme", date: "2026-05-04" });
    expect(out.reused).toBe(false);
    expect(out.folderName).toBe("[2026-05-04] Acme");
    // create: ルート1 + sub1 = 2回, copy: file 2回
    expect(fake.calls.create).toHaveBeenCalledTimes(2);
    expect(fake.calls.copy).toHaveBeenCalledTimes(2);
  });

  it("copyTemplateFolder: 権限エラーを permission_denied に分類", async () => {
    const drive = {
      files: {
        list: async () => {
          throw Object.assign(new Error("Forbidden"), { code: 403 });
        },
        get: async () => ({ data: {} }),
        create: async () => ({ data: {} }),
        copy: async () => ({ data: {} }),
      },
    };
    __setDriveClientForTest(drive as never);
    await expect(copyTemplateFolder({ companyName: "x", date: "2026-05-04" })).rejects.toMatchObject(
      {
        name: "DriveIntegrationError",
        code: "permission_denied",
      },
    );
  });

  it("DriveIntegrationError は code/status を保持する", () => {
    const e = new DriveIntegrationError("auth_failed", "boom", { status: 401 });
    expect(e.code).toBe("auth_failed");
    expect(e.status).toBe(401);
    expect(e.message).toBe("boom");
  });
});
