# Anthropic API キー ローテーション手順

**実行頻度**: 90日毎、または漏洩疑いが生じた直後 (即時)。
**実行者**: 情シス担当 + CSプロダクト責任者の二者立ち会い。

## 前提

- 旧 v1 (`api/claude.js`) が存在した期間、キーが**無認証で公開ドメインに露出していた可能性がある**。本Runbook初回は漏洩前提でローテートする。
- 新 v2 (`neo-cs-v2/app/api/claude/route.ts`) は Supabase JWT 認証 + レート制限 + 監査ログを完備。

## 手順

1. **新キー発行**
   - Anthropic Console → API Keys → Create Key
   - 名前: `neo-cs-prod-YYYYMMDD-rotation`
2. **Vercel 環境変数 更新** (本番 → ステージング → ローカルの順)
   - `ANTHROPIC_API_KEY` を新値に置換
   - Vercel Dashboard → Settings → Environment Variables
3. **再デプロイ**
   - `vercel --prod` または `git push` でCIから本番デプロイ
4. **疎通確認** (新キーで成功することを確認)
   ```sh
   curl -X POST https://cs.neoacademia.jp/api/claude \
     -H "Authorization: Bearer <test-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"ping"}]}'
   ```
   `200 OK` を確認。`X-Request-Id` をRunbookに記録。
5. **旧キー失効**
   - Anthropic Console → 旧キー → Revoke
6. **claude_api_calls の異常検出**
   - 旧キー時代の error_code が急増していないか、過去24h を確認
   ```sql
   select date_trunc('hour', created_at) as hr, count(*), array_agg(distinct error_code)
     from claude_api_calls
    where created_at > now() - interval '24 hours'
    group by 1 order by 1;
   ```

## 失敗時のロールバック

- 新キーで疎通失敗 → Vercel Dashboard で旧キー値に戻し、Anthropic Console での Revoke 前に踏みとどまる。
- ステップ5 (Revoke) 後に旧キーを使う systems が見つかった場合は、当該システム側を即時新キーへ移行。
