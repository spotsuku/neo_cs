# supabase/seed.sql — デモデータ投入手順

このディレクトリの `seed.sql` は neo_cs プロジェクトのデモ用シードデータです。
`migrations/0001_init.sql` ～ `migrations/0012_voc_items.sql` のスキーマに完全準拠しており、
すべての企業名・人名・メールアドレスは架空 (例: `株式会社デモAlpha`, `@demo.example.jp`) です。

## 投入される主なデータ

| カテゴリ | 件数 | 備考 |
|---|---|---|
| organizations | 1 | デフォルトテナント `00000000-0000-0000-0000-000000000001` |
| app_users | 10 | admin 1 / manager 2 / member 6 / viewer 1 |
| app_admin_emails | 1 | `admin@demo.example.jp` を初期 admin として登録 |
| products / product_courses | 4 / 6 | academia / hyogikai / aiken / commu を全網羅 |
| companies | 15 | 全社架空 (デモAlpha 〜 デモOmicron) |
| assignments | 45 | 1社あたり primary / secondary / sales_owner を割当 |
| company_contacts | 30 | 1社2名 |
| stakeholders | 約 100 | 1社 5〜10 名、4種別 (decision_maker / champion / user / at_risk) |
| contracts | 約 30 | 1社 1〜3 契約。status を active / renewal_window / onboarding / handoff / renewed / churned で分散 |
| participants / sessions / attendance | 多数 | 契約あたり 2〜5 参加者 × 3 セッション + 出席記録 |
| account_journeys | 約 30 | onboarding / adoption / value / expansion を分散 |
| success_plans / goals | 多数 | 継続型契約のみ。目標3件×契約 |
| renewal_milestones | 多数 | T-120/T-90/T-60/T-30 を生成。過去日は done + evidence 付与 |
| health_score_snapshots | 約 250 | 12週分 × 継続型契約。green 60% / yellow 30% / red 10% に分布 |
| weekly_reviews + actions + next_actions | 多数 | 直近4週分 |
| meeting_logs | 約 50 | 1社 3〜5 件 |
| onboarding_template_categories / items / tasks | 多数 | 4プロダクト分のテンプレ + 適用済みタスク |
| survey_questions / templates / surveys / responses | 多数 | NPS / 満足度 / 適用度 / 自由記述。回答3件/サーベイ |
| churn_events / reasons | churned 数件 | budget 理由 |
| **churn_signals** | **high 2 / medium 3 / low 2** | Slack通知デモ用の未通知 high シグナル含む |
| **expansion_opportunities** | **high 1 / medium 2** | upsell / cross_sell / seat_expansion |
| **voc_items** | **6件** | 機能要望 / 不満 / 提案 / 称賛を分散。new / triaged / shipped を含む |
| one_on_one_logs | 5件 | manager × member の履歴 |
| kpi_snapshots | 31件 | 直近31日 |
| domain_events | 4件 | BI/分析サンプル |

合計 INSERT 行数: 約 1,800+ (`wc -l supabase/seed.sql` で確認)。

## 実行手順

### A. Supabase Dashboard (本番) で実行する場合

1. Supabase ダッシュボードで対象プロジェクトを開き、**SQL Editor** に移動。
2. まず migrations を順に流す (0001 → 0012)。すでに `supabase db push` 等で適用済みなら不要。
3. 新しいクエリを開き、`supabase/seed.sql` の内容を貼り付けて **Run**。
4. 通常 5〜15 秒で完了。`on conflict do nothing` を全行に付与済みなので、
   再投入しても既存行は上書きされない (デモ用追加投入のたびに走らせて OK)。
5. 任意で初期 admin email を追加:
   ```sql
   insert into app_admin_emails (email, note)
   values ('your_real_admin@yourdomain.com', '本番管理者')
   on conflict do nothing;
   ```

### B. ローカル `supabase start` で動作確認する場合

```bash
# プロジェクトルートで
cd /Users/furuken/dev/neo_cs

# 1. ローカル Supabase 起動 (db_url は出力された値を使う)
supabase start

# 2. migrations を適用
supabase db reset            # 全マイグレーション + 自動的に supabase/seed.sql を流す
                             # (Supabase CLI は seed.sql を自動検出)

# 3. アプリ側で REPO_DRIVER=supabase を指定して起動
cd neo-cs-v2
REPO_DRIVER=supabase \
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
  npm run dev
```

`supabase db reset` を使えば migrations + seed が一発で投入されます。
`seed.sql` 単体で投入したい場合は:

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)" \
  -f supabase/seed.sql
```

### C. 本番にデモデータを投入する際の注意

- 本ファイルは「**デモ用**」です。実顧客データの環境に投入しないでください。
- `app_admin_emails` への `admin@demo.example.jp` 登録は、本番ログイン後に
  自動 admin 昇格してしまう可能性があります。本番投入前に該当行を削除するか、
  実 admin email に置き換えてください (該当箇所はファイル冒頭の app_admin_emails)。
- 投入後の確認:
  ```sql
  select count(*) from companies;     -- 15
  select count(*) from contracts;     -- ~30
  select count(*) from health_score_snapshots; -- ~250
  select severity, count(*) from churn_signals group by severity;
  select status, count(*) from voc_items group by status;
  ```

## デモシナリオ概要

- 健全度: green 約 60% / yellow 約 30% / red 約 10% に分布。
- 解約予兆: high 2件 (score_drop, milestone_overdue), medium 3件。Slack通知デモに使えます。
- エクスパンション機会: 上位プラン昇格 (high), クロスセル (medium), 席数拡大 (medium)。
- VOC: 機能要望/不満/提案/称賛 を計6件、status は new/triaged/backlog/shipped を分散。
- 全プロダクト (academia/hyogikai/aiken/commu) を最低1社が契約。
- 1on1 ログは manager 2名 × member 5名で5件。

## 再生成方法

`/tmp/seedgen/gen.py` に Python 生成スクリプトがあります (一時ディレクトリ)。
内容を調整して再生成する場合は同スクリプトを編集 → `python3 gen.py` で `supabase/seed.sql` が上書きされます。
本格運用するならこのスクリプトを `scripts/gen_seed.py` 等に移してリポジトリ管理してください。
