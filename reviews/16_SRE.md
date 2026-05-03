# SRE レビュー: neo_cs CSポータル

レビュー対象: `server.js`, `api/*.js`, `supabase_schema.sql`, `next.config.mjs`, `package.json`, フロント (`index.html`, `neo-cs-v2/`)
レビュー日: 2026-05-03

---

## 総評

**結論: 本番環境に出してはいけないレベル**。社内ツールという前提を最大限割り引いても、SREとしての運用観点はほぼ「ゼロ」。`server.js` は単一プロセスの素のNode HTTPサーバーで、ヘルスチェックなし、構造化ログなし、メトリクスなし、レート制限なし、タイムアウト設定なし、リトライ/サーキットブレーカーなし、認可レイヤなし。`supabase_schema.sql` は RLS を `using (true) with check (true)` で全開放、つまり anon キーが漏れた瞬間に**全社データの読み・書き・削除が誰でも可能**。ローカル `.env` の自前パーサ (`server.js:14-25`) は引用符の扱いも雑で、シークレット管理戦略が事実上存在しない。SLO は定義されておらず、障害が起きていることを検知する手段すらない。「動けばよい」ハッカソン水準。

---

## 致命的問題

### 1. RLS 実質無効化 (`supabase_schema.sql:29-30`)
```sql
create policy "allow_all" on ps_data for all using (true) with check (true);
```
- anon キーは公開キー前提なので、ブラウザのDevToolsから抜けば**誰でも全レコード DELETE 可能**。
- データバックアップ手順がないため、悪意あるユーザーが `DELETE` を投げた時点で復旧不能。これは可用性・データ保全の両面で最悪。

### 2. データバックアップ手順なし
- リポジトリ内に `pg_dump` や Supabase Point-in-Time-Recovery の設定・運用ドキュメントが一切ない。
- `ps_data` は単一テーブルに全業務データを JSONB で押し込む設計 (`supabase_schema.sql:5-10`)。1キーの破損 = 機能全停止。
- リストア手順 (RTO/RPO) が未定義。「障害発生時、何分で何時点まで戻せるか」が誰も答えられない状態。

### 3. ヘルスチェックエンドポイント不在 (`server.js:51-92`)
- `/healthz`, `/readyz`, `/livez` のいずれもない。
- ロードバランサ・k8s・Vercel ヘルスチェック・外形監視 (UptimeRobot等) のどれも組めない。
- 結果: 障害検知は「誰かが気づく」になる。MTTD = 数時間〜。

### 4. シークレット管理が脆弱 (`server.js:14-25`)
自前 `.env` パーサ。`dotenv` を使わない理由が不明で、エスケープ・複数行・コメント途中などのエッジケースで壊れる。`.env` のローテーション手順、Vault/Secrets Manager 連携、監査ログ、いずれも不在。`ANTHROPIC_API_KEY` / `SUPABASE_ANON_KEY` がコミット履歴に紛れ込んだ場合の検知機構もない。

### 5. CORS が全開 (`api/claude.js:4`, `api/auth.js:14`, `api/db.js:11`, `api/db-all.js:9`)
```js
res.setHeader('Access-Control-Allow-Origin', '*');
```
- 認証なしAPI + ワイルドカードCORS = 任意のサイトから `/api/claude` を叩いて Anthropic クレジットを焼ける。**金銭被害に直結する可用性リスク**。

### 6. `/api/claude` に認証・レート制限なし (`api/claude.js` 全体)
- API キーで Anthropic を叩くプロキシなのに、呼び出し側の認可チェックがゼロ (`api/claude.js:11-18` は HTTP メソッドと環境変数しか見ていない)。
- 1ユーザーが `while(true) fetch('/api/claude')` を回せば即座に Anthropic 月額予算が枯渇。**コスト面の SLA 破壊**。

### 7. タイムアウト未設定で詰まる (`api/claude.js:67-86`, `api/auth.js:141-148`, `api/db.js:111-126`)
`https.request` に `timeout` オプションなし。Anthropic / Supabase / Google が応答を返さなければ Node プロセスのソケットを無限に握り続け、同時接続枯渇でサービス全停止。`server.js` も `server.timeout` を設定していない。

### 8. 単一プロセス・単一インスタンス前提 (`server.js:94`)
- クラスタリング/PM2/プロセスマネージャ前段なし。
- 未捕捉例外で `process.exit` した場合の自動再起動仕組みなし (`process.on('uncaughtException', ...)` も未定義)。
- デプロイ戦略 (Blue/Green, Canary, Rolling) の記述がリポジトリに存在しない。ロールバックは「git revert して `node server.js`」で、無停止再起動は不可能。

---

## 重要な懸念

### 9. 構造化ログ・メトリクスなし
- `console.log` / `console.error` のみ (`api/claude.js:36`, `api/auth.js:52`, `api/db.js:82`)。
- request_id, user_id, latency, status の相関ログなし。インシデント時の調査が泥沼化。
- Prometheus / OpenTelemetry / Sentry のどれも入っていない。アラートの起点が物理的にない。

### 10. リトライ・サーキットブレーカーなし
- Anthropic API が 5xx / 529 (overloaded) を返したら即座にユーザーへ500を返す (`api/claude.js:73-77`)。指数バックオフ・冪等リトライ・フォールバックなし。
- Supabase 障害時の縮退運転 (read-only モード、キャッシュ応答) もなし。フロントは「保存できませんでした」を出すだけ。

### 11. N+1 / 非効率クエリ
- `upsertUser` (`api/auth.js:96-112`) は新規判定のために `getAllUsers()` で**全ユーザー取得**してから `length === 0` 判定。ユーザー1万人になったら毎ログインで全件読む。
- `/api/db/all` (`api/db-all.js:23`) は `ps_data` を全件返す。`limit` なし、ページングなし。データが増えれば必ず破綻。
- `/api/db` の `all` 側は `limit=1000` (`api/db.js:41`) だが、業務全データを 1000 件で打ち切るため**サイレントなデータ欠損**につながる。これは可用性以前にデータ整合性事故。

### 12. インデックス設計が不十分 (`supabase_schema.sql:33`)
- `key` には UNIQUE 制約 (`supabase_schema.sql:7`) があるので別 idx は冗長。
- `neo_users.email` の UNIQUE / インデックスは SQL 上に**スキーマ定義ファイルすら存在しない** (auth.js は `neo_users` を前提にしているが `supabase_schema.sql` に CREATE TABLE がない)。スキーマ管理がコード化されていない = マイグレーション戦略不在。

### 13. SQL インジェクション/URL インジェクション (`api/auth.js:100, 115, 125`, `api/db.js:55`)
`encodeURIComponent` してはいるが、PostgREST の `eq.` 構文は値に `,` `(` 等を含むとフィルタ切断されうる。RLS が無効状態と組み合わさると影響が拡大。

### 14. Next.js (`neo-cs-v2`) 側のエラーハンドリング不在
- `app/` 配下に `error.tsx` / `global-error.tsx` / `not-found.tsx` の存在を確認できず (`ls` 結果より)。
- `next.config.mjs` (`neo-cs-v2/next.config.mjs:1-6`) は `reactStrictMode` のみ。`output`, `experimental.instrumentationHook`, `headers()` (security headers, HSTS, CSP) すべて未設定。

### 15. パストラバーサル対策が不十分 (`server.js:77`)
`!filePath.startsWith(__dirname)` のみ。`path.resolve` を通しておらず、`%2e%2e` 等のエンコード経由は `pathname` 段階で保護されているとはいえ、ホワイトリスト方式の方が安全。`/api/` を除く任意の `__dirname` 配下ファイル (例: `.env`, `package-lock.json`) が**読み放題**。これは事実上のシークレット漏洩経路。

### 16. プレイブックなし
- `reviews/` 配下に運用ドキュメントなし。「Supabaseが落ちたとき」「Anthropicが529のとき」「Googleログインが落ちたとき」の手順が書かれていない。
- オンコール体制、エスカレーションパス、ステータスページ — すべて無。

---

## 評価できる点

1. **依存ゼロ運用**: `package.json:11` で外部依存ゼロ。サプライチェーン攻撃面は最小。`https` モジュール直叩きは堅牢な選択（ただしタイムアウト未設定で台無し）。
2. **パストラバーサル対策の意図はある** (`server.js:77`): 不完全だが、意識はある。
3. **upsert の onConflict 指定** (`api/db.js:72`): PostgREST の正しい使い方。
4. **`updated_at` トリガ** (`supabase_schema.sql:13-23`): 監査・デバッグの基本ができている。
5. **Next.js 16 への更新** (commit `de49b2a`): 脆弱性対応のキャッチアップは早い。

---

## 改善提案（優先度順）

### P0 (即時)
1. **RLS ポリシーを書き直す**。`auth.uid()` ベースのポリシーに変更し、anon キーで全削除できる状態を解消 (`supabase_schema.sql:29`)。
2. **`/api/claude` に認証必須化 + レート制限 (per-user / per-IP)**。最低でも `auth.js` の verify を通したセッションを要求。Vercel KV / Upstash Redis でトークンバケット。
3. **CORS を社内ドメインに限定**。`*` を全廃 (`api/*.js`)。
4. **HTTP/HTTPS タイムアウトを全 `https.request` に設定** (推奨 10s、Anthropic は 60s)。`server.timeout = 30000` も追加。
5. **Supabase の自動バックアップ/PITR を有効化**し、リストア手順を `runbooks/restore.md` に明文化。RTO/RPO を定義。

### P1 (1週間)
6. **`/healthz` (liveness) と `/readyz` (Supabase + Anthropic への ping を含む) を実装**。
7. **構造化ログ (pino 等) と Sentry / Logflare 連携**。request_id を全レスポンスに付与。
8. **`dotenv` 採用 + `.env.example` 整備**。ローカル自前パーサ (`server.js:14-25`) を撤廃。Production はホスティング側のシークレット機構 (Vercel Env / GCP Secret Manager) に寄せる。
9. **`uncaughtException` / `unhandledRejection` ハンドラ追加**、PM2 もしくは systemd で auto-restart。
10. **リトライ + サーキットブレーカー** (`opossum` 相当の自前実装でも可) を Anthropic / Supabase 呼び出しに導入。

### P2 (1ヶ月)
11. **マイグレーション管理**: Supabase CLI で `supabase/migrations/` に履歴化。`neo_users` の DDL を補完。
12. **メトリクス**: リクエスト数 / レイテンシ p50/p95/p99 / 5xx 率 を Prometheus 形式 or Vercel Analytics で取得。SLO (例: 可用性 99.5%, p95 < 800ms) を定義。
13. **デプロイ戦略**: Vercel の Preview Deploy をステージング扱い、Production への昇格は手動承認。ロールバックは Vercel の「Promote previous」で確立。
14. **依存サービス縮退**: Supabase 落下時はキャッシュした read-only 表示、Anthropic 落下時は AI 機能だけグレーアウト、を `app/error.tsx` + フィーチャーフラグで実装。
15. **インシデントプレイブック** (`runbooks/`): 障害種別ごとの初動・連絡先・復旧手順を整備。ポストモーテムテンプレも置く。
16. **セキュリティヘッダ**: `next.config.mjs` の `headers()` で CSP / HSTS / X-Frame-Options / Referrer-Policy を設定。
17. **静的ファイル配信を Next.js 側に集約**: `server.js` を廃止し、すべて Next.js (もしくは Vercel) のルーティングへ寄せる。レガシー `index.html` (7238行!) のフロントは段階的に `neo-cs-v2` へ移行完了させる。

---

**総合評定: D-（社内βでも怖い）**
SLO/SLA を定義する前に、まず「観測できる状態」「壊れても戻せる状態」「攻撃されても被害が局所化される状態」を作るところから。コードの量より、**運用の前提が欠落している**のが最大の問題。
