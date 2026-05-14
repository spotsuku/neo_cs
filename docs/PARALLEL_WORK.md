# PARALLEL_WORK — 並行開発ルール

> 複数の Claude 会話 (または開発者) が同時にこのリポジトリを触るときの衝突回避ルール。

---

## 1. 基本原則

1. **触る Route Group をブランチ名に含める** — `feat/<group>-<topic>` の形
2. **同じ Route Group は同時に 1 会話** — 別会話が触っている group には入らない
3. **横断ファイル** (`lib/repository/types.ts`, `lib/domain/community/*`, `components/ui/*` 等) を変更する PR は**他の作業を一時停止してから**出す
4. **docs/ の変更は単独 PR** — 機能 PR と混ぜない

---

## 2. Route Group ↔ 責務マップ

| ブランチ prefix | 触る範囲 | 主な担当機能 |
|---|---|---|
| `feat/lifecycle-*` | `app/(lifecycle)/`, `lib/domain/onboarding/` | F1 オンボーディング |
| `feat/cohort-*` | `app/(cohort)/`, `lib/domain/program/` | F2 期/回運営 |
| `feat/communication-*` | `app/(communication)/`, `lib/integrations/`, `lib/ai/`, `lib/domain/email/` | F3 Gmail+AI |
| `feat/relationship-*` | `app/(relationship)/`, `lib/domain/community/`, `lib/domain/voc/` | F5/F6 関係性・VoC |
| `feat/analytics-*` | `app/(analytics)/`, `lib/domain/kpi/`, `lib/domain/health/` | F7 + 経営分析 |
| `feat/self-*` | `app/(self)/`, `lib/domain/tasks/` | 個人領域 |
| `feat/admin-*` | `app/(admin)/`, `lib/security/`, `lib/auth/` | 管理 |
| `feat/system-*` | `app/(system)/`, `lib/supabase/` | 認証・UI 参照 |

横断系:
| ブランチ prefix | 触る範囲 |
|---|---|
| `refactor/repo-*` | `lib/repository/` (types/server/index/mock/supabase) |
| `refactor/ui-*` | `components/ui/`, `components/nav/`, `components/shell/`, `tailwind.config.ts` |
| `chore/migrations-*` | `supabase/migrations/` |
| `docs/*` | `docs/`, `CLAUDE.md`, `README.md` |

---

## 3. 会話を立ち上げる時のテンプレ

新規会話の冒頭プロンプトの推奨フォーマット:

```
担当: feat/<group>-<topic>
範囲: app/(<group>)/ と lib/domain/<area>/ のみ触る
触らない: 他 group、横断ファイル (lib/repository/, components/ui/, lib/security/)

タスク:
[具体内容]

前提として以下を必ず読んでから着手:
- CLAUDE.md
- docs/PRODUCT.md (F1〜F7 のうち該当機能)
- docs/ARCHITECTURE.md §3 (Repository 二系統)
- docs/CURRENT_STATE.md (実装度マップ)
- docs/PARITY.md (本番崩れ既知問題)
```

---

## 4. 衝突しやすい点 (要注意)

### 4.1 `lib/repository/types.ts`
- 新規 Repository / Domain 型を追加するときは**ここを必ず通る**
- 複数会話が同時に編集すると merge conflict 必至
- **ルール**: 型追加だけ先に独立 PR で出して merge → 他作業は rebase してから着手

### 4.2 `components/ui/`
- 全画面で使う基底コンポーネント
- 既存 props のシグネチャを変えると全画面影響
- **ルール**: 既存 props は破壊変更しない (新 prop 追加 + default 設定で対応)

### 4.3 `lib/domain/community/`
- CCC Framework / 関与度判定の中核 ([docs/COMMUNITY.md](COMMUNITY.md))
- 関与度算出ロジックを変えると F5/F6/F7 すべてに影響
- **ルール**: 触る前に `docs/COMMUNITY.md` の §9 (CCC) を再読

### 4.4 `supabase/migrations/`
- マイグレーションは**番号順 + 不可逆**
- 同時に 2 つ作ると番号衝突
- **ルール**: 作る前に `ls supabase/migrations/` で最新番号を確認 → `git pull` してから採番

---

## 5. PR 出すときの相互チェック

PR テンプレ (`.github/PULL_REQUEST_TEMPLATE.md`) の以下を必ず埋める:

- 触った Route Group
- 触った横断ファイル (あれば)
- 並行する他 PR への影響 (なければ「なし」)
- typecheck / build / test 通過確認

---

## 6. レビュー優先度

| 種類 | 優先度 | 理由 |
|---|---|---|
| `refactor/repo-*` | 最高 | 他作業をブロックする可能性、早く merge |
| `chore/migrations-*` | 高 | 採番衝突防止 |
| `docs/*` | 高 | 判断の根拠、小さいから即 merge |
| `feat/<group>-*` | 中 | 影響範囲が group 内に閉じる |
| `refactor/ui-*` | 中 | 影響広いが既存 props 維持で抑制 |

---

## 7. 巻き戻し

問題が起きたら:
- 直近の安全点: タグ `baseline-2026-05-14` (Phase 2 開始前)
- v1 アーカイブ: ブランチ `archive/v1-legacy`
