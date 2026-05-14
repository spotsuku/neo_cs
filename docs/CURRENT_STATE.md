# CURRENT STATE — 実装現状マップ

> Phase 1.5 調査 (2026-05-14)。[PRODUCT.md §2.6](PRODUCT.md) の F1〜F7 が現状コードでどこまで実装されているか、および本番崩れに繋がる構造的問題の網羅リストを残す。
>
> このドキュメントは **「残す / 捨てる / 作り直す」判断の材料**。Phase 2 のフォルダ整理と Phase 1 の本番化対応の優先順位はここから引く。

---

## 1. F1〜F7 機能の実装度サマリ

| # | 機能 | 実装度 | 残課題 |
|---|---|---|---|
| F1 | オンボーディング可視化 | ✅ 実装済 | 期限アラート自動化 (cron 未) |
| F2 | コホート (期/回) 一括管理 | 🟡 部分実装 | **一括メール送信が未実装** |
| F3 | Gmail リアルタイム + AI | ✅ 実装済 | AI 抽出→反映フローの最終確定 |
| F4 | Drive テンプレート + 送付履歴 | 🟡 部分実装 | **送付履歴テーブル不在** |
| F5 | 企業 × NEO 関係性 → パートナー化 | ✅ 実装済 | Inner Rings UI 統合 |
| F6 | VoC もれなく対応 + 継続ステータス | 🟡 部分実装 | **AI 分類が辞書ベース** (Claude 置換予定) |
| F7 | アンケート連携 + AI 関与度判定 | 🟡 部分実装 | 関与度スコアの UI 表示 |

---

## 2. 機能別の詳細

### F1. オンボーディング可視化 ✅
- 全契約のステータス取得・表示: [app/onboarding/page.tsx:22-26](../neo-cs-v2/app/onboarding/page.tsx#L22-L26)
- ChecklistView / MatrixView (UI 2 種)
- 期日計算: `onboardingItemRepo.listByContractIds()` + `dueOffsetDays`
- テンプレ: [lib/domain/onboarding-template.ts](../neo-cs-v2/lib/domain/onboarding-template.ts) で shape 変換、`onboardingTemplateRepo.listByProduct()` で DB から取得

### F2. コホート一括管理 🟡
- ✅ プログラム一覧 / 期 × 企業マトリクス: [app/programs/page.tsx](../neo-cs-v2/app/programs/page.tsx), [app/programs/[termId]/ProgramMatrix.tsx](../neo-cs-v2/app/programs/[termId]/ProgramMatrix.tsx)
- ✅ テンプレ一括編集: [app/programs/[termId]/edit/TemplateEditor.tsx](../neo-cs-v2/app/programs/[termId]/edit/TemplateEditor.tsx)
- ❌ **一括メール送信フロー未実装** (Gmail 送信は単発のみ)
- ❌ イベント招待・面談日程一斉提示の動線がない

### F3. Gmail + AI 自動判定 ✅
- 受信同期: [app/api/cron/gmail-sync/route.ts](../neo-cs-v2/app/api/cron/gmail-sync/route.ts) — `gmailConnectionRepo` 経由で 30 分 cron
- AI 抽出: [lib/integrations/email-ai.ts:17-56](../neo-cs-v2/lib/integrations/email-ai.ts#L17-L56) — Claude API で 5 種類のシグナル抽出 (progress / risk / churn / expansion / meeting)
- AI 提案レビュー UI: [app/inbox/extractions/page.tsx](../neo-cs-v2/app/inbox/extractions/page.tsx) — `aiExtractionRepo` に `reviewed=false` で未承認保存
- 返信送信は人間のクリック + 確認ダイアログ必須 (memory に固定済)

### F4. Drive テンプレ連携 🟡
- ✅ Drive 連携基盤: [lib/integrations/google-drive.ts:63-80](../neo-cs-v2/lib/integrations/google-drive.ts#L63-L80) — service account で顧客別フォルダ複製
- ✅ フォルダ URL 保存: `companyRepo` に `drive_folder_url` 列
- ✅ 失敗時リトライ: [app/api/integrations/drive/retry/[companyId]](../neo-cs-v2/app/api/integrations/drive/retry/[companyId]/)
- ❌ **送付履歴テーブルが存在しない** — `emailRepo` は受信のみで送信ログがない
- ❌ 「どの版の資料をいつ誰に送ったか」が遡れない

### F5. パートナー化 ✅
- 関係性タイプ自動判定: [lib/domain/contactCommunity.ts:19-67](../neo-cs-v2/lib/domain/contactCommunity.ts#L19-L67) — `contactCommunityTier` (at_risk / casual / active / core) ← **CCC Framework の関与度 4 段階と整合**
- 評議会会員 (年間型) のブロック管理: [lib/domain/hyogikai-membership.ts](../neo-cs-v2/lib/domain/hyogikai-membership.ts)
- 企業 Vision: `companyVisionRepo`
- 残: Inner Rings の登り方を UI で可視化

### F6. VoC 取りこぼしゼロ 🟡
- ✅ 抽出: [lib/domain/voc.ts:55-56](../neo-cs-v2/lib/domain/voc.ts#L55-L56) — キーワード辞書ベース
- ✅ チャネル統合: weekly_review / survey_response / meeting_log の sources
- ✅ カンバン UI: [app/voc/VocBoard.tsx](../neo-cs-v2/app/voc/VocBoard.tsx)
- ✅ 通知: [app/api/cron/voc-notify/route.ts](../neo-cs-v2/app/api/cron/voc-notify/route.ts)
- ❌ **AI 分類が純辞書ベース** — Claude 置換で精度向上が課題

### F7. アンケート + 関与度判定 🟡
- ✅ 取込: [app/api/surveys/import/apply](../neo-cs-v2/app/api/surveys/import/apply/)
- ✅ 関与度算出ロジック: [lib/domain/engagement.ts:96-103](../neo-cs-v2/lib/domain/engagement.ts#L96-L103) — **4 段階 (core / active / casual / at_risk)** 完備
- ✅ 企業別集計の builder
- ❌ 関与度スコアを UI で前面に出していない (ダッシュボードに出ていない可能性)

---

## 3. ⚠️ 構造的問題 (本番崩れの直接原因)

### 3.1 Client Component が `@/lib/repository` (常に mock) から実値を import

[PARITY.md §2](PARITY.md) で既に特定済の問題。**確証あり**:

| ファイル | "use client" | import | 本番で見ているデータ |
|---|---|---|---|
| [components/ContractChurnSignals.tsx:6](../neo-cs-v2/components/ContractChurnSignals.tsx#L6) | ✅ | `churnSignalRepo` | **mock データ (本番でも)** |
| [components/CompanyVocList.tsx:6](../neo-cs-v2/components/CompanyVocList.tsx#L6) | ✅ | `vocItemRepo` | **mock データ (本番でも)** |

→ ChurnSignals と VoC は F5 / F6 の中核だが、企業詳細ページ内で**常に mock を表示している**。修正優先度: **P0**。

> 型 import のみのファイル (ExecutiveDashboard, InboxView, VocBoard 等) は実害なし。上記 2 件以外で値 import している Client Component がないかは追加 grep で確認推奨 (今回の 2 つの調査で結論が分かれた箇所)。

### 3.2 Supabase 実装が未整備の Repository

下記 8 Repo は `lib/repository/supabase/` に実装がなく、`mock` の `_global-store.ts` メモリストアで動いている → **本番でも mock 経由**:

```
accountJourneyRepo
contactRepo
meetingLogRepo
onboardingItemRepo
stakeholderRepo
successPlanRepo
+ 2 件 (未列挙)
```

→ DB スキーマは存在する可能性が高いので、Supabase 実装を順次追加する作業。

### 3.3 Supabase 実装の値ズレ ([PARITY.md §1](PARITY.md))

`Company.contracts: []` / `mrr: 0` / `lastTouchDays: 0` 固定問題。F5 (パートナー化) の表示にも影響。

---

## 4. 「残す / 捨てる / 作り直す」判断材料

### 残す (動いている、F1〜F7 のコアを支える)
- Repository インターフェース ([types.ts](../neo-cs-v2/lib/repository/types.ts))
- F1 オンボーディング機能一式
- F3 Gmail 連携 + AI 抽出基盤 ([lib/integrations/](../neo-cs-v2/lib/integrations/), [lib/ai/](../neo-cs-v2/lib/ai/))
- F5 関与度判定ロジック ([lib/domain/contactCommunity.ts](../neo-cs-v2/lib/domain/contactCommunity.ts), [engagement.ts](../neo-cs-v2/lib/domain/engagement.ts))
- F7 アンケート取込基盤
- supabase/migrations (39 マイグレーション)
- 監査ログ / RLS / 認可基盤

### 直す (構造的問題 P0)
- `@/lib/repository` Client 直 import の解消 (ChurnSignals / VoC を Server Component or props 経由に)
- `Company` の Supabase 実装で contracts / mrr / lastTouchDays を実解決
- 未整備 8 Repo の Supabase 実装追加

### 作り直す候補 (アーキ刷新)
- ヘルススコア: 単一スコア → **CCC 5 本柱レーダー + 関与度 4 段階**へ ([COMMUNITY.md](COMMUNITY.md))
- F6 の AI 分類: 辞書ベース → Claude 置換
- フォルダ構成: 機能フラットな `app/*` を **「内諾後フロー / コホート / 関係性 / 解析」** といった**目的ベース**に再編 (Phase 2 で議論)

### 捨てる (Phase 2 で削除候補)
- [_legacy/](../_legacy/) — archive ブランチへ退避
- ルートの古い [supabase_schema.sql](../supabase_schema.sql) (`supabase/migrations/` と重複の可能性)
- ルートの [screenshot-after-portal.png](../screenshot-after-portal.png) (2.8MB)
- ルートの `.vercel/` (v2 のものがあれば不要)
- 完了済 `.claude/worktrees/romantic-elion-b2db57`

---

## 5. フォルダ再構成への示唆

現在の `app/*` 配下は機能フラット (`inbox`, `voc`, `surveys`, `onboarding`, `weekly`, `programs`, `companies` 等)。F1〜F7 の観点で見直すと、以下の**目的別グループ**に再整理できる:

| グループ | 含む画面 (現状) | F |
|---|---|---|
| 内諾後フロー | onboarding | F1 |
| コホート運営 | programs, weekly, attendance | F2 |
| メール+AI | inbox | F3 |
| 資料/ナレッジ | (新規) drive 連携画面 | F4 |
| 関係性 | companies, voc | F5 / F6 |
| 解析 | surveys, dashboard, reports | F7 / 経営 |
| 個人 | me, tasks, notifications | (横断) |

ただし **App Router の URL 構造 = フォルダ構造**なので、URL を変える=ユーザーのブックマーク影響。ルーティングは現状維持 + `lib/` 配下を機能別に再編、というのが現実解の可能性。Phase 2 で再検討。

---

## 6. 次のアクション

優先度順:

### 即実行できる (P0)
1. [PARITY.md §5 P0](PARITY.md) 修正: ChurnSignals / VoC の Server 経由化
2. Company supabase 実装の埋め (`contracts` / `mrr` / `lastTouchDays`)
3. 未整備 8 Repo の Supabase 実装

### 議論が必要 (Phase 2)
4. ヘルススコア → CCC 5 本柱 + 関与度 4 段階への再設計
5. フォルダ構造の再編方針 (URL 変更可否)
6. F4 送付履歴テーブルの設計
7. F6 AI 分類の Claude 化

### 別作業 (Phase 3)
8. CONTRIBUTING.md / PARALLEL_WORK.md / PR テンプレ
9. `_legacy/` 等の物理削除
