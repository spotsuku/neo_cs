# CLAUDE.md — NEO CS ポータル プロジェクト指示

> このファイルは Claude Code がこのリポジトリで作業するときの常時ルール。
> `~/dev/CLAUDE.md` の共通ルール + ここの内容が両方適用される。

---

## 0. 作業前に必ず読むドキュメント

`docs/` 配下が**プロダクト判断の正本**。会話冒頭で必要なものを読むこと。

| 何を知りたいか | 読むべきファイル |
|---|---|
| プロダクトの目的・スコープ・F1〜F7 | [docs/PRODUCT.md](docs/PRODUCT.md) |
| 技術構造・Repository 二系統の罠 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 指標設計の根拠 (CCC Framework) | [docs/COMMUNITY.md](docs/COMMUNITY.md) |
| 現状の機能実装度・残課題 | [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) |
| mock↔supabase 乖離・本番崩れの原因 | [docs/PARITY.md](docs/PARITY.md) |
| UI を作るときのルール | [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) |
| 並行作業のルール (会話 ID / ブランチ) | [docs/PARALLEL_WORK.md](docs/PARALLEL_WORK.md) |

---

## 1. 鉄則 (絶対に守る)

### 1.0 ⚠️ 最重要: `lib/mock/*` を一切触らない

**`lib/mock/*` は本番運用では一切参照されない**。新規ファイル追加・既存ファイル編集・seed 配列の更新、すべて禁止。

理由:
- 本番は `REPO_DRIVER=supabase` で `lib/repository/supabase/*` 経由で実 DB を読む
- `lib/mock/*` は (将来削除予定の) 旧開発用 stub
- ここに変更を加えても本番には**一切反映されない**
- 「mock を触る = 何も達成していない」と理解すること

**マスタ系データを変更したい場合**:
- `products` / 事業・コース定義 → `lib/master/products.ts` (or DB の `products` テーブル)
- 表示フォーマッタ (yen / pct 等) → `lib/master/format.ts`
- 日付ユーティリティ → `lib/master/date.ts`

**実データ操作**:
- 必ず `@/lib/repository/server` 経由

### 1.1 Repository 層の使い分け
- **Server から Repository を使う場合は必ず `@/lib/repository/server` から import**。`@/lib/repository` は Server で使わない (Client 用旧ファサード)。
- Client Component から Repository を直接呼ばない。Server Component or Server Action 経由でデータを受け取る。
- 詳細: [docs/ARCHITECTURE.md §3](docs/ARCHITECTURE.md)

### 1.2 不可逆アクションは人間のクリック必須
- メール送信 / 契約変更 / 削除 などは **必ず確認ダイアログ + 人間のクリック** を介す。AI 自動実行禁止。
- 詳細: [memory: project-ai-replaces-work](.claude/projects/-Users-furuken-dev-neo-cs/memory/)

### 1.3 用語統一
| 日本語 | 英語キー | 用途 |
|---|---|---|
| 事業 | `business` | NEO ACADEMIA / 評議会 / AI リスキリング / コミュマネの学校 |
| 期 | `cycle` | アカデミア / 評議会 / コミュマネ |
| 回 | `round` / `session` | AI リスキリング |
| 関与度 | `engagement` | 4 段階 (core/active/casual/at_risk) |

### 1.4 UI 変更時の検証
新しい画面・コンポーネントを出す前に:
- [ ] mock データを長文・空配列・null に差し替えても崩れない
- [ ] `REPO_DRIVER=supabase` で実 DB に接続した状態でも見た目が同じ
- [ ] [styleguide](neo-cs-v2/app/(system)/styleguide/) に新規パターンを追加 (必要時)

詳細: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)

---

## 2. フォルダ構成 (Phase 2 で再編済)

```
neo-cs-v2/app/
├── (lifecycle)/      F1 内諾後フロー       (onboarding)
├── (cohort)/         F2 期/回運営          (programs / weekly / attendance)
├── (communication)/  F3 メール+AI          (inbox / notifications / chat)
├── (relationship)/   F5/F6 関係性          (companies / voc)
├── (analytics)/      F7+経営分析            (dashboard / reports / surveys)
├── (self)/           個人領域              (me / tasks / profile)
├── (admin)/          管理                  (settings / manager / help)
├── (system)/         認証/UI 参照          (auth / login / styleguide)
└── api/              Route Handler

neo-cs-v2/components/
├── ui/  nav/  shell/  company/  contract/  health/
├── journey/  kpi/  voc/  stakeholder/  alerts/  tasks/

neo-cs-v2/lib/
├── repository/  types.ts が正本。Server は server.ts 経由
├── domain/      community / health / churn / kpi / email / voc / journey / ...
├── ai/  integrations/  security/  observability/  notifications/
```

Route Groups `(...)` は URL に出ない (例: `/companies` のまま)。**並行作業時は触る group を明示**すること。

---

## 3. 開発ワークフロー

### ブランチ
- `main` 直 push は緊急時のみ。基本は feature ブランチで PR
- 命名: `feat/<topic>` / `fix/<topic>` / `chore/<topic>` / `docs/<topic>` / `refactor/<topic>`
- 並行作業: `feat/<group>-<topic>` で route group を含める (例: `feat/cohort-bulk-status`, `fix/relationship-company-detail`)

### コミット
- 日本語で簡潔に
- Co-Authored-By を含める
- 機密 (env / key) はコミットしない (gitleaks で自動検知)

### PR
- [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) に従う
- typecheck + build + test の通過を確認してから出す

### 検証コマンド (頻出)
```bash
cd neo-cs-v2
npm run typecheck       # tsc --noEmit
npm run lint
npm run test            # vitest
SKIP_BUILD_ASSERT=1 npm run build   # ローカルビルド
```

---

## 4. やってはいけないこと

- `app/*` の **URL を変える** ような変更 (Route Group の括弧を消す等) — 既存ブックマーク影響
- `_legacy/` を復活させる — archive/v1-legacy ブランチで保存済
- 1on1 ログをユーザーごとに記録する機能の追加 ([memory: feedback_no_1on1_per_user](.claude/projects/-Users-furuken-dev-neo-cs/memory/feedback_no_1on1_per_user.md))
- メール一斉送信機能の追加 — 個別送信 + 振り分けの方針
- 内諾前の営業フェーズ管理の追加 — 本ポータルのスコープ外

---

## 5. baseline / 巻き戻し

- 構造変更前の baseline: タグ `baseline-2026-05-14`
- v1 凍結退避: ブランチ `archive/v1-legacy`

---

## 6. 並行会話の運用

複数の Claude 会話を同時に走らせる場合は [docs/PARALLEL_WORK.md](docs/PARALLEL_WORK.md) を読むこと。
原則: **触る Route Group をブランチ名に含めて競合を避ける**。
