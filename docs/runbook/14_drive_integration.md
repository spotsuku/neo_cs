# Runbook 14 — Google Drive 自動連携

Phase4-#5 で実装。営業 (neo-sales) → CS 引継ぎ webhook 受信時に
テンプレフォルダを共有ドライブ配下に複製し、顧客個別フォルダを生成して
URL を `companies.drive_folder_url` / `sales_handoffs.drive_folder_url`
に保存する。

## 関連ファイル

- `lib/integrations/drive-naming.ts` — フォルダ命名規則 `[YYYY-MM-DD] 会社名`
- `lib/integrations/google-drive.ts` — Drive API クライアント (service account JWT)
- `lib/integrations/drive-provisioning.ts` — 重複防止 + DB保存を一括する高レベル関数
- `app/api/integrations/sales/handoff/route.ts` — handoff 受信時に呼び出し
- `app/api/integrations/drive/retry/[companyId]/route.ts` — 手動リトライ (admin/manager)
- `app/api/cron/drive-backfill/route.ts` — 週次 backfill (未作成 company を最大10件)
- `supabase/migrations/0018_drive_metadata.sql` — companies テーブル列追加
- `app/companies/[id]/CompanyDetail.tsx` — ヘッダにフォルダリンク表示

## 環境変数 (Vercel + .env.local)

```
GOOGLE_DRIVE_SHARED_DRIVE_ID
GOOGLE_DRIVE_CUSTOMER_PARENT_FOLDER_ID
GOOGLE_DRIVE_TEMPLATE_FOLDER_ID
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL
GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON   # JSON 全文 (改行含む)
```

未設定なら `configured()=false` で no-op フォールバック (handoff 自体は通る)。

## 命名規則

`[YYYY-MM-DD] 会社名`   例: `[2026-05-04] イオン九州`

- date は handoff の `contract.startDate` を採用
- `/ \ : ? * | < >` 等の禁止文字は除去
- 200 文字を超える場合は会社名側を切詰める
- 変更したい場合は `lib/integrations/drive-naming.ts` のみ差し替え

## 重複防止

1. `listFolders(parentId, { exactName })` で親直下の同名フォルダを検索
2. ヒットすればそのフォルダ ID を返却 (再利用)
3. なければテンプレを `cloneFolderRecursive` で再帰複製

これにより handoff 再送 / リトライで二重作成しない。

## 手動リトライ

handoff 受信時に Drive 連携が失敗したら以下で再実行できる。

```bash
curl -X POST \
  -H "Authorization: Bearer <Supabase JWT>" \
  https://<app>/api/integrations/drive/retry/<companyId>
```

- `admin` / `manager` のみ実行可
- 既に `companies.drive_folder_url` がある場合は 200 + `status: already_present`
- 失敗時は 502 + `code` (`permission_denied` / `template_not_found` / `api_error` 等)

## 週次 backfill

`/api/cron/drive-backfill` が毎週月曜 01:00 (UTC) に動作。
`drive_folder_id IS NULL AND is_active` を作成日昇順で最大 10 件処理する。
レートを抑えるため直列実行。

## トラブルシューティング

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `code=permission_denied` | サービスアカウントが共有ドライブに招待されていない | 共有ドライブ設定で `neo-cs-drive-bot@...` を「コンテンツ管理者」以上で追加 |
| `code=template_not_found` | `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID` が誤り or サービスアカウントから不可視 | テンプレフォルダの ID と権限を確認 |
| `code=not_configured` | env 不足 | Vercel と `.env.local` の env を確認 |
| 二重フォルダができた | listFolders の name クエリ前に名前変更が起きた可能性 | 片方をアーカイブして DB は最新で上書き |

## サービスアカウント仕様

- スコープ: `https://www.googleapis.com/auth/drive`
- `supportsAllDrives: true` / `includeItemsFromAllDrives: true` を全リクエストに付与
- フォルダ複製は Drive API の `files.copy` 非対応のため、
  `cloneFolderRecursive()` で「新規フォルダ作成 + ファイルを `files.copy`」を再帰実行
