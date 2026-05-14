# CONTRIBUTING — 開発参加ガイド

> Phase 0/2 で整備した規約を一箇所にまとめる。詳細ルールは各リンク先を参照。

---

## 1. 最初に読むもの

1. [CLAUDE.md](../CLAUDE.md) (ルート) — 鉄則と用語統一
2. [docs/PRODUCT.md](PRODUCT.md) — プロダクトの目的・スコープ
3. [docs/ARCHITECTURE.md](ARCHITECTURE.md) — 技術構造の地図
4. [docs/PARALLEL_WORK.md](PARALLEL_WORK.md) — 並行作業のルール

---

## 2. 環境構築

```bash
git clone <repo>
cd neo_cs
cp neo-cs-v2/.env.example neo-cs-v2/.env.local   # mock のみで動かすなら追加設定不要
npm install --prefix neo-cs-v2
npm run dev                                       # http://localhost:3000
```

詳細: [README.md](../README.md)

---

## 3. ブランチ運用

| 用途 | prefix | 例 |
|---|---|---|
| 新機能 | `feat/` | `feat/cohort-bulk-status`, `feat/relationship-engagement-radar` |
| バグ修正 | `fix/` | `fix/relationship-company-detail-null` |
| リファクタ | `refactor/` | `refactor/repo-supabase-company-mrr` |
| 雑務 | `chore/` | `chore/migrations-add-mail-log` |
| ドキュメント | `docs/` | `docs/community-framework-update` |

**並行作業時は Route Group 名をブランチ名に入れる**: [PARALLEL_WORK.md §2](PARALLEL_WORK.md)

---

## 4. コミット

- 日本語で簡潔に (例: 「コホート画面に出欠サマリを追加」)
- 1 コミット = 1 トピック
- Co-Authored-By を含める (Claude が書いた場合)
- 機密情報 (env / API key / 認証情報) は絶対にコミットしない (gitleaks が pre-commit で検知)

---

## 5. PR

[.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) に従う。

PR 前に必ず:
```bash
cd neo-cs-v2
npm run typecheck && npm run lint && npm run test && SKIP_BUILD_ASSERT=1 npm run build
```

---

## 6. コーディング規約

### 6.1 TypeScript / Next.js
- Server Component を基本とし、Client Component (`"use client"`) は必要最小限
- Server からデータ取得は **`@/lib/repository/server`** 経由のみ
- Client から Repository を直接呼ばない (props または Server Action 経由)

### 6.2 用語
| 日本語 | 英語キー |
|---|---|
| 事業 | `business` |
| 期 | `cycle` |
| 回 | `round` / `session` |
| 関与度 | `engagement` (core/active/casual/at_risk) |

### 6.3 UI
- Tailwind トークンのみ使用 (生 hex / `gray-XXX` 禁止)
- 長文・空配列・null に強い実装 ([DESIGN_SYSTEM.md §4](DESIGN_SYSTEM.md))
- 新規パターンは [/styleguide](../neo-cs-v2/app/(system)/styleguide/) に追加

### 6.4 テスト
- 純関数 (`lib/domain/*`) には Vitest テストを書く
- Server Action や Route Handler の主要分岐にもテスト
- E2E は Playwright (`tests/e2e/`)
- RLS は `tests/rls/`

---

## 7. やってはいけないこと

- `app/*` の URL を変える変更 (Route Group の括弧を消す等)
- メール一斉送信機能の追加 (スコープ外)
- 1on1 ログをユーザー別に記録する機能の追加 (運用方針)
- 内諾前の営業フェーズ管理の追加 (スコープ外)
- AI による不可逆アクションの自動実行 (送信 / 契約変更 / 削除)

---

## 8. 困ったら

- 設計判断で迷う → [docs/PRODUCT.md](PRODUCT.md), [docs/COMMUNITY.md](COMMUNITY.md)
- 本番でバグった → [docs/PARITY.md](PARITY.md), [docs/CURRENT_STATE.md](CURRENT_STATE.md)
- mock と supabase で動きが違う → [docs/PARITY.md](PARITY.md)
- 巻き戻したい → タグ `baseline-2026-05-14` / ブランチ `archive/v1-legacy`
