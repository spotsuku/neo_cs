# CSP enforce 昇格 チェックリスト

**現状**: [neo-cs-v2/next.config.mjs](../../neo-cs-v2/next.config.mjs) で `Content-Security-Policy-Report-Only` を全ページに付与。`Content-Security-Policy` (enforce) は未設定。
**目的**: Report-Only で2週間ノイズを把握 → 違反原因を全て解消 or allowlist 化 → enforce へ切替。

---

## 0. 前提が揃っているか確認

以下が **すべて満たされて** から本Runbookに着手:

- [ ] `SENTRY_DSN` が本番環境変数に設定済 (B/C項完了)
- [ ] `CSP_REPORT_URI` が本番に設定済。エンドポイントは Sentry CSP collector もしくは自前
  - Sentry: `https://<sentry-host>/api/<project-id>/security/?sentry_key=<dsn-public-key>`
- [ ] 本番デプロイで `Content-Security-Policy-Report-Only` ヘッダが実際に返ってきているか
  ```sh
  curl -sI https://cs.neoacademia.jp/ | grep -i content-security-policy
  ```
- [ ] Sentry に CSP 違反が **1件以上届いているか** (届いていなければ collector 設定がおかしい)

---

## 1. ノイズ収集期間 (14日間)

### 1-1. 開始日を決める

- 大型リリース直後は避ける (新規違反が混在し判断不能)
- 開始日を `incidents/csp-enforcement-<開始日>.md` に固定し、Slack `#cs-alerts` に宣言

### 1-2. 毎日のレビュー (5分)

- [ ] Sentry → CSP 違反の **新規** Top 10 を確認
- [ ] 直近24h の違反件数の推移をグラフで確認 (急増していないか)
- [ ] 1日1回、`docs/runbook/csp-violations-<日付>.md` に下記を記録:
  - directive (script-src / connect-src 等)
  - blocked-uri
  - source (どのページ)
  - 件数

### 1-3. 違反の分類

| 分類 | 例 | 対応 |
|---|---|---|
| **真の脆弱性** | 想定外の外部 JS が実行されようとしている | **enforce 化を急ぐ理由**。攻撃の可能性も視野 |
| **正当な依存** | `connect-src` に Vercel Analytics、Sentry endpoint、Google Fonts 等 | allowlist 追加 |
| **自社コードの inline** | 古い `style="..."` / `onclick=` | **コード修正で除去**。allowlist で許すと意味が薄れる |
| **ブラウザ拡張機能** | `chrome-extension://*` | 無視 (CSP では `report-uri` で報告されるが拒否しても問題ない) |
| **ノイズ** | Safari の `webkit-masked-url://hidden/` 等 | 無視 |

---

## 2. allowlist 調整

`neo-cs-v2/next.config.mjs` の `csp` 配列を更新する:

```js
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",       // ← ★ enforce 前に 'unsafe-inline' を外したい
  "style-src 'self' 'unsafe-inline'",        // ← ★ Tailwind 都合で残す or nonce 化検討
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://o<sentry-org>.ingest.sentry.io",
  // ... (省略)
].filter(Boolean).join('; ');
```

### 2-1. `'unsafe-inline'` (script-src) の除去計画

**enforce 前に必ず除去**。手順:

1. inline `<script>` を全削除 (Next.js は通常出さないが、手動で書いていないか確認)
2. `onclick=` `onchange=` 等の inline event handler を React イベントに置換 (旧 v1 由来コードが残っていないか)
3. 残る場合は **nonce 方式** に切替: middleware で per-request nonce を発行し、`script-src 'self' 'nonce-<value>'` に
   - 参考: Next.js docs "Content Security Policy"

### 2-2. `'unsafe-inline'` (style-src) の方針

- Tailwind ユーティリティのみで賄える限り `'unsafe-inline'` は不要
- しかし React の `style={{ ... }}` を多用しているとブロックされる
- **enforce 直前に `style={{}}` の使用件数を grep で計測**し、少なければ class 化、多ければ `'unsafe-inline'` を残す判断

```sh
grep -rn "style={{" neo-cs-v2/app neo-cs-v2/components | wc -l
```

**判断基準**: 50箇所以下 → class化して `'unsafe-inline'` 削除 / それ以上 → 残す

---

## 3. Enforce 切替

### 3-1. 切替前の最終確認

- [ ] 直近 7日間の **新規** 違反が**真の脆弱性ゼロ**であること
- [ ] allowlist 調整が反映され、24h 以上 Sentry に違反流入がないこと
- [ ] ステージング環境で enforce ヘッダを **48時間先行** で出し、回帰がないことを確認

### 3-2. 切替

`neo-cs-v2/next.config.mjs` で `Content-Security-Policy-Report-Only` を `Content-Security-Policy` に変更し、**`report-uri` も併設**して enforce後も継続収集:

```js
const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },             // ← 変更
  // (Report-Only エントリは削除)
  // ...
];
```

→ **段階デプロイ**:
1. ステージングのみ enforce 化 → 48時間運用
2. 本番の **Beta 組織のみ** enforce (middleware で組織IDを見て切替) → 1週間
3. 本番全体 enforce

### 3-3. 切替後の監視

- [ ] 切替直後 30 分間、Sentry を実況見守り
- [ ] 24時間で違反 0、機能異常 0 なら成功宣言
- [ ] 1件でもユーザー影響が出たら **即ロールバック** (`vercel rollback`)

---

## 4. ロールバック条件

下記いずれかに該当したら、迷わず Report-Only に戻す:

- 主要画面が表示できない / 真っ白になる
- ログイン・週次レビュー・面談ログのいずれかで操作不能
- Sentry に同種の違反が 1分間に 100件超

ロールバック方法: `next.config.mjs` の差分を revert → `vercel --prod`。所要時間目安 5分。

---

## 4-α. 最終チェック (2026-05-03 追記 — E項完了時)

実装側の前提条件が揃ったことを記録:

- [neo-cs-v2/lib/observability/sentry.ts](../../neo-cs-v2/lib/observability/sentry.ts) — `SENTRY_DSN` 設定で発火、未設定時は stderr フォールバック
- [neo-cs-v2/lib/observability/sentry.test.ts](../../neo-cs-v2/lib/observability/sentry.test.ts) — no-op フォールバックの動作回帰テスト3件
- [neo-cs-v2/.env.example](../../neo-cs-v2/.env.example) — DSN 発行手順 + サンプリング率推奨値を `SENTRY_DSN` セクションに記載
- [neo-cs-v2/next.config.mjs](../../neo-cs-v2/next.config.mjs) — `CSP_REPORT_URI` 環境変数があれば `report-uri` ディレクティブを `Content-Security-Policy-Report-Only` に自動付与する実装済

**ユーザー側 残作業**:
1. Sentry org で Project 発行 → DSN 取得
2. Vercel env に `SENTRY_DSN` / `SENTRY_TRACES_SAMPLE_RATE=0.1` / `CSP_REPORT_URI=<sentry security endpoint>` を設定
3. `cd neo-cs-v2 && npm i @sentry/nextjs` (本番必須)
4. 本番 deploy → 24h で Sentry に違反 + 通常エラーの両方が届くか確認
5. 本 Runbook §1〜3 に従い 14日間ノイズ収集 → enforce 切替

→ 上記5ステップが完了するまで、CSP は **Report-Only のまま運用**。

## 5. 関連

- [00_index.md](00_index.md)
- [03_incident_response.md](03_incident_response.md)
- `roadmap/04_運用セキュリティ_完了報告.md` §6-4
- `reviews/11_情シスセキュリティ.md`
