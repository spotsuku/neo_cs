# PARITY — mock ↔ supabase 乖離レポート

> Phase 1 調査 (2026-05-14)。「デモ画面 (mock) では問題ないのに本番 (supabase) で崩れる」現象の構造的原因と具体箇所をまとめる。
> 修正計画は Phase 2 以降で別ドキュメント化。本ドキュメントは**観察事実のみ**。

---

## 0. エグゼクティブサマリ

本番で表示が壊れる原因は **2 種類** ある:

1. **Client Component が `@/lib/repository` から直接 mock を引いている経路がある** — `REPO_DRIVER=supabase` でも mock データが描画される。
2. **mock 実装と supabase 実装で返り値が違う** — Supabase 実装は関連エンティティを別テーブルに分離した結果、`contracts: []` / `mrr: 0` / `lastTouchDays: 0` 等の既定値を返す。UI は mock の「必ず値がある」前提で書かれており、null/空配列/undefined を考慮していない。

---

## 1. Repository 実装の返り値ズレ

### 1.1 Company

| フィールド | mock の振る舞い | supabase の振る舞い | UI 影響 |
|---|---|---|---|
| `contracts` | 当該企業の契約配列 | **常に `[]`** ([supabase/companyRepo.ts:34-58](../neo-cs-v2/lib/repository/supabase/companyRepo.ts#L34-L58)) | `c.contracts.length > 0` 系の条件分岐が常に false |
| `mrr` | `number` で必ず存在 | **常に `0`** | KPI 計算結果が 0 / NaN |
| `lastTouchDays` | 実数値 | **常に `0`** | UI に「0日前」固定表示 |
| `kana` / `industry` | null 想定なし | `null ?? ""` で空文字に正規化 | mock 側で `null.toLowerCase()` crash 可能性 |

型定義は [types.ts:68-74](../neo-cs-v2/lib/repository/types.ts#L68-L74) で `Company = MockCompany & { organizationId }` だが、Supabase 実装はこの型を満たすために**既定値で埋めているだけ**。型は通るが実体は空。

### 1.2 Contract

| フィールド | mock | supabase |
|---|---|---|
| `mrr` | `number` 必須 | `mrr_amount != null ? Number(...) : undefined` ([supabase/contractRepo.ts:89-106](../neo-cs-v2/lib/repository/supabase/contractRepo.ts#L89-L106)) |
| `revenue` | `number` 必須 | `undefined` 可 |
| `ownerName` | mock の関連 join 済み | DB は `owner_user_id` のみ。呼び出し側で名前解決が必要 |

`types.ts:400` 付近で optional になっていないが、Supabase 実装は `undefined` を返す → 型と実体の不一致。

### 1.3 他 Repository (未調査)

surveys / participants / sessions / attendance / emails / aiExtractions / 等は今回の調査範囲外。同型の問題が潜んでいる可能性が高い。Phase 2 で個別チェック。

---

## 2. Client Component の Repository 直接参照 (主犯)

**`@/lib/repository` は常に mock を返す** ([index.ts:23](../neo-cs-v2/lib/repository/index.ts#L23))。下記の Client Component は本番でも mock を見る:

| ファイル | 行 | 呼び出し | 影響 |
|---|---|---|---|
| [components/ContractChurnSignals.tsx](../neo-cs-v2/components/ContractChurnSignals.tsx) | 6, 29-30 | `churnSignalRepo.listByContract()` を `useEffect` で | **解約予兆が常に mock データ** |
| [components/CompanyVocList.tsx](../neo-cs-v2/components/CompanyVocList.tsx) | — | `vocItemRepo` | **VoC が常に mock** |

型 import のみ (実害なし) のファイル:
- [app/ExecutiveDashboard.tsx:27](../neo-cs-v2/app/ExecutiveDashboard.tsx#L27)
- [app/inbox/InboxView.tsx](../neo-cs-v2/app/inbox/InboxView.tsx)
- [app/voc/VocBoard.tsx](../neo-cs-v2/app/voc/VocBoard.tsx)

### 2.1 正しい経路 (参考)
- [app/companies/page.tsx:10-18](../neo-cs-v2/app/companies/page.tsx#L10-L18) — `@/lib/repository/server` から import (Server Component) → `REPO_DRIVER` に従う。
- `app/companies/new/actions.ts` — Server Action で `getRepo()` 経由。

### 2.2 `lib/mock/*` 直 import
README で禁止しているこの違反は **発見されず** (`grep -r "from.*@/lib/mock"` 0 件)。ガードは効いている。

---

## 3. UI が mock 前提で書かれている代表ケース

[app/companies/CompaniesView.tsx](../neo-cs-v2/app/companies/CompaniesView.tsx) に集中:

| 行 | 症状 |
|---|---|
| 62-66 | `c.contracts && c.contracts.length > 0` → supabase では常に false |
| 198 | `mrr: ac.mrr` を集計 → supabase は `undefined` で `NaN` 波及 |
| 283-285 | `c.kana.toLowerCase()` 等 → null/undefined ガードなし |
| 799 | `{c.lastTouchDays}日前` → 常に「0日前」 |

[app/companies/page.tsx:50-51](../neo-cs-v2/app/companies/page.tsx#L50-L51) は本来 Repository が返すべき `Company.contracts` を**アプリ層で手動復元している** — Repository インターフェースが満たされていない兆候。

### 3.1 フォールバックなし
`logoUrl` / `pictureUrl` が undefined のとき `<img src="">` になる箇所あり。`Avatar` 共通コンポーネント未整備。

---

## 4. `REPO_DRIVER` の効果境界

| レイヤー | 切替が効くか |
|---|---|
| Server Component / Server Action / Route Handler | ✅ `getRepo()` 経由で正しく切替 |
| Client Component | ❌ `@/lib/repository` は常に mock |
| middleware | ⚠️ `REPO_DRIVER !== "supabase"` で素通し ([middleware.ts:143](../neo-cs-v2/middleware.ts#L143)) — 認証は supabase 時のみ動く |
| ログイン UI 分岐 | `isMock` フラグで切替 ([app/login/page.tsx:47](../neo-cs-v2/app/login/page.tsx#L47)) |

---

## 5. 修正方針 (要約 — 詳細は Phase 2 で)

優先度順:

### P0 (本番ブロッカー)
1. **Client Component の Repo 直接参照を Server 経由に移す** — `ContractChurnSignals`, `CompanyVocList` を Server Component 化するか、データを props で受ける形にリファクタ。
2. **Supabase Company 実装で contracts / mrr / lastTouchDays を実際に解決する** — N+1 を避けるためバッチクエリで join。

### P1 (型と実体の不一致)
3. **types.ts の nullability を Supabase 実装の実態に合わせる** — `mrr?: number` 等 optional 化し、UI 側に明示的ハンドリングを強制。
4. **UI の null/empty ガード追加** — `CompaniesView` の 4 箇所 + 同パターンの全画面横断点検。

### P2 (構造)
5. **`@/lib/repository` (mock 固定ファサード) の廃止計画** — Client Component が Repo を直接呼ばない設計に統一できれば、`index.ts` は不要になる。
6. **未調査 Repository (surveys/attendance/emails 等) の同型検査**。
7. **`index.ts` と `server.ts` の export リスト乖離を解消** (短期的には server.ts を正本に統合)。

---

## 6. 次のアクション

- このドキュメントを Phase 0 のレビューに含める
- Phase 1.5: `CompaniesView` を「null/空配列/長文」テストデータで実機検証 → スクショ添付
- Phase 2 着手前に「Client Component が Repo を直呼びしている箇所」の完全リストを `grep` で取得 (今回見つけたのは 2 件だが他にもある可能性)
