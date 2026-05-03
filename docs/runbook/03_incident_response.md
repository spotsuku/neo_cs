# インシデント初動フロー

**目的**: P0/P1 インシデントを「誰が」「何分以内に」「どの順で」処理するかを固定し、判断のばらつきを排除する。
**スコープ**: 本番 (cs.neoacademia.jp) で発生するすべての可用性・データ・セキュリティ事象。

---

## 1. 重大度の定義

| 重大度 | 定義 | 例 | 一次対応 SLA | 報告先 |
|---|---|---|---|---|
| **P0** | 全顧客影響 / データ漏洩 / 不可逆の損失 | サイト全断、認証停止、顧客データ流出疑い、Anthropic キー漏洩 | **15分以内** | CS責任者 + 経営 + 法務 (即時) |
| **P1** | 一部機能停止 or 一部顧客影響 | /api/claude 全失敗、特定企業の週次レビュー保存不可、Health 503 連続 | **60分以内** | CS責任者 (1時間以内) |
| **P2** | 軽微・代替手段あり | 一部画面の表示崩れ、レート制限の誤発火 | 翌営業日 | 起票のみ (`incidents/`) |
| **P3** | 改善要望相当 | UX 改善、ログの読みづらさ | スプリント計画 | バックログ |

**昇格ルール**: 30分以内に状況が悪化したら一段昇格。逆に「想定より影響軽微」が確定したら降格。判断は インシデントコマンダ (IC)。

---

## 2. 初動ロール (IC = Incident Commander)

| ロール | 担当 | 責務 |
|---|---|---|
| **IC** | 一次検知者 (オンコール) | 全体指揮・タイムライン記録・判断・連絡先決定 |
| **Tech Lead** | DBA / SRE | 復旧作業の手を動かす |
| **Comms** | CS責任者 (or 代理) | 顧客連絡・社内周知 |
| **Scribe** | 任意の手空きメンバー | 全コマンド・判断を時系列で `incidents/<日付>-<slug>.md` に記録 |

→ 1人で全部はNG。**最低 IC + Scribe** は分けること。

---

## 3. 初動 30 分のチェックリスト

### t+0〜5min: 検知・宣言

- [ ] Slack `#cs-incident` に **「INCIDENT 宣言: <事象>」** を投稿 (誰でも書ける)
- [ ] IC を名乗る ("IC: 古野")
- [ ] 重大度を仮判定 (P0/P1/P2)
- [ ] `/api/health?deep=1` を叩く
  ```sh
  curl -s https://cs.neoacademia.jp/api/health?deep=1 | jq .
  ```
- [ ] Vercel Dashboard (deployments / functions logs) を開く
- [ ] Sentry Issues を時系列降順で確認

### t+5〜15min: 影響範囲の確定

- [ ] 「いつから」: Sentry / `audit_logs` / `claude_api_calls` の急変点
  ```sql
  -- claude エラーレートの急変
  select date_trunc('minute', created_at) m,
         count(*) total,
         count(*) filter (where error_code is not null) errs
    from claude_api_calls
   where created_at > now() - interval '2 hours'
   group by 1 order by 1;
  ```
- [ ] 「誰に」: 影響ユーザー数、組織 (`organization_id` 単位)
- [ ] 「何が」: write系 / read系 / 認証 / AI / DB
- [ ] **データ漏洩疑いがあるか?** (`audit_logs.action='read_sensitive'` または `select_bulk` の異常急増)
  - YES → 即 P0、法務に第一報。**証跡保全** (`audit_logs`/`claude_api_calls` を CSV エクスポートし S3 へ別保存)

### t+15〜30min: 一次封じ込め

- [ ] 縮退モード ON (該当サービスのみ)
  ```sh
  # Vercel 環境変数を更新して即時再デプロイ
  # 例: Anthropic 障害
  vercel env add DEGRADED_ANTHROPIC production
  # → true を入力 → vercel --prod
  ```
- [ ] 必要なら ロールバック
  ```sh
  vercel rollback <previous-deployment-url>
  ```
- [ ] 漏洩疑いのキー / セッションは即時失効
  - Anthropic: [docs/runbook/01_anthropic_key_rotation.md](01_anthropic_key_rotation.md)
  - Supabase: Service Role Key を rotate
  - 影響ユーザーは `app_users.is_active=false` で強制ログアウト ([04_user_offboarding.md](04_user_offboarding.md))

---

## 4. 連絡テンプレ

### 4-1. 社内一次報 (Slack `#cs-incident`)

```
[INCIDENT 宣言] <事象を1行>
重大度: P0 / P1
発生確認: YYYY-MM-DD HH:MM JST
影響: <顧客 / 機能 / 範囲>
IC: <氏名>
状況: <調査中 / 一次封じ込め中 / 復旧作業中>
次回更新: <15分後>
```

→ **15分ごとに同テンプレで更新**。沈黙は最も悪い。

### 4-2. 顧客通知 (P0 でデータ影響/可用性影響が確定した場合)

法務レビュー必須。雛形:

```
平素より NEO CSポータルをご利用いただきありがとうございます。
YYYY-MM-DD HH:MM 頃より、<事象> が発生しておりました。
影響範囲: <具体的に>
現在の状況: <復旧済み / 復旧作業中>
原因: <判明している範囲で、推測は書かない>
今後の対応: <恒久対策・期日>
お問い合わせ: <窓口>
```

個情法26条該当 (要配慮個人情報の漏洩 等) なら、**3〜5日以内に個人情報保護委員会へ報告**。法務確認。

---

## 5. 復旧後 24 時間以内 (ポストモーテム前段)

- [ ] タイムラインを `incidents/YYYY-MM-DD-<slug>.md` に確定 (Scribe → IC レビュー)
- [ ] 影響顧客リストを別ファイルに固定 (audit_logs クエリの結果)
- [ ] 一次封じ込めで設定した一時フラグ (DEGRADED_*, レート制限緩和等) を**戻すか、恒久化**を判断
- [ ] Sentry の関連 Issue を Linked
- [ ] 暫定再発防止策が**24時間以内に**コードか設定で入っていること

---

## 6. ポストモーテム (1週間以内)

テンプレ: `incidents/_template_postmortem.md` (未整備 — 次回P0発生時に整備)

書く内容 (固定):

1. **Timeline** (分単位、UTC + JST 両併記)
2. **影響** (顧客数、データ件数、可用性ダウンタイム秒数)
3. **直接原因** (1行)
4. **根本原因** (5 Whys)
5. **何が機能したか** (アラート、Runbook、人)
6. **何が機能しなかったか**
7. **アクションアイテム** (担当 + 期日。3週間以内に閉じる)

**犯人探し禁止 / blameless**。プロセスの欠陥として書く。

---

## 7. 関連

- [00_index.md](00_index.md)
- [01_anthropic_key_rotation.md](01_anthropic_key_rotation.md)
- [02_supabase_backup_restore.md](02_supabase_backup_restore.md)
- [04_user_offboarding.md](04_user_offboarding.md)
- [05_csp_enforcement.md](05_csp_enforcement.md)
