# N+1 走査 監査記録

**対象**: `neo-cs-v2/app/` Server Components / Server Actions
**実施日**: 2026-05-03
**実施者**: ストリーム04
**前提**: ストリーム01のリポジトリ層はインターフェース確定 + mock 実装稼働、Supabase 実装は途上 (`assignments`/`oneOnOneLogs` は B項で着地、`churnSignals` は D項で進行中)

---

## 0. 走査の方針

「N+1」とは: ループ内 (またはループ相当の `.map`/`.forEach`) で `await repo.xxx()` を呼び、件数 N に比例して問い合わせが発生する状態。Supabase 実装になった瞬間にレイテンシが線形悪化するため、**mock 段階で構造を直す**ことが重要。

判定基準:
- ❌ NG: `for` / `.map` / `.forEach` 内で `await repo.xxx()` (N回クエリ確定)
- ⚠ 要警戒: 配列 `.filter(x => arr.some(y => x.k === y.k))` などの O(n×m) パターン — mock では問題ないが、supabase repo に持ち込むと N+1 化しやすい
- ✅ OK: `Promise.all([...])` で固定本数並列、Map/Set の事前構築で結合

---

## 1. 走査結果サマリー

| ファイル | 判定 | 内容 |
|---|---|---|
| [app/team/page.tsx](../../neo-cs-v2/app/team/page.tsx) | ✅ OK | `Promise.all` 5並列 + Map/Set 事前構築。`stats.map` 内に await なし |
| [app/team/[userId]/one-on-one/page.tsx](../../neo-cs-v2/app/team/[userId]/one-on-one/page.tsx) | ✅ OK | `Promise.all` 4並列固定。N+1 なし |
| [app/companies/[id]/page.tsx](../../neo-cs-v2/app/companies/[id]/page.tsx) | ✅ 修正完了 (2026-05-03) | リポジトリ通しに全面書換。`.filter().some()` 入れ子は ID 集合 + Set lookup に置換。`Promise.all` 2段で N+1 排除済 — §2-1 修正完了サマリー参照 |
| [app/companies/page.tsx](../../neo-cs-v2/app/companies/page.tsx) | ✅ OK | "use client" + mock。DB問い合わせなし |
| [app/companies/[id]/CompanyDetail.tsx](../../neo-cs-v2/app/companies/[id]/CompanyDetail.tsx) | (調査外) | Client component。受け渡しのみ |

### 発見事項のヘッドライン

1. **/team は健全**: 02のB項実装は `Promise.all` + Map index を徹底しており、N+1 はゼロ。今後の追加も同パターン踏襲を推奨。
2. **/companies/[id] が最大の負債**: リポジトリ層を**完全にバイパス**して `lib/mock/*` を直接 import しており、まずリポジトリ通しに直す必要がある。同時に、Supabase 実装段階で必ず以下の修正が要る (§2-1)。
3. **/companies (一覧) は client+mock** で DB に触れていないため、"use server" 化のタイミングで再走査が必要 (現状はOK)。

---

## 2. 詳細分析

### 2-1. ✅ `app/companies/[id]/page.tsx` (修正完了 2026-05-03)

#### 修正完了サマリー

ストリーム01から l〜q (`contactRepo.listByCompany` ほか 6 メソッド) が mock 実装で着地したため、本ファイルを以下の構造に全面書換:

```ts
const company = await companyRepo.getById(id);
if (!company) return notFound();

// 第1段: 5 リソース並列
const [contacts, meetings, allCycles, stakeholders, journeys] = await Promise.all([
  contactRepo.listByCompany(id),
  meetingLogRepo.listByCompany(id, { sort: "date desc", limit: 50 }),
  contractRepo.listByCompany(id),                                        // all
  stakeholderRepo.listByCompany(id),
  accountJourneyRepo.listByCompany(id),
]);

// active を派生 (再フェッチ回避) — lib/mock/onboarding.ts:293 と同式
const contracts = allCycles.filter((c) => c.status !== "renewed" && c.status !== "churned");

// 第2段: contractIds で一括取得
const activeContractIds = contracts.map((c) => c.id);
const allContractIds    = allCycles.map((c) => c.id);
const [onboardingItemsAll, plansAll] = await Promise.all([
  onboardingItemRepo.listByContractIds(activeContractIds),
  successPlanRepo.listByContractIds(allContractIds),
]);

// 受信側でも Set lookup で再フィルタ (リポジトリが厳格でない場合の安全弁)
const activeIdSet = new Set(activeContractIds);
const allIdSet    = new Set(allContractIds);
const items = onboardingItemsAll.filter((i) => activeIdSet.has(i.contractId));
const plans = plansAll.filter((sp) => allIdSet.has(sp.contractId));
```

| 観点 | Before | After |
|---|---|---|
| クエリ数 (Supabase化想定) | 9+ 直列、★A/★B で N+1 化リスク | **3 (1 + 5並列 + 2並列)** |
| `.filter().some()` 入れ子 (★A items×contracts) | あり | **Set lookup に置換、O(1)** |
| `.filter().some()` 入れ子 (★B plans×cycles) | あり | **Set lookup に置換、O(1)** |
| リポジトリ層通し | バイパス (mock直import) | ✅ 全リクエストが repo 経由 (audit/logging hook 効く) |
| activeContracts 再フェッチ | (allContracts と別importで重複) | 1回フェッチして派生 |
| `CompanyDetail.tsx` props 形 | 同じ (互換) | **無変更** — Client側に影響なし |

**`tsc --noEmit` 通過 / `npm run build` 通過 / `app/companies/[id]` は ƒ (Dynamic) として正しく登録**。

ストリーム02 が CompanyDetail.tsx に追加した Health セクション・解約予兆一覧と競合しないよう、編集はデータ取得層 (page.tsx) に閉じている。

#### 修正前 (記録目的): 旧コード

```ts
const company       = companies.find((c) => c.id === id);
const companyContacts   = contacts.filter((c) => c.companyId === id);
const logs              = meetingLogs.filter((m) => m.companyId === id).sort(...);
const companyContracts  = activeContracts.filter((c) => c.companyId === id);
const companyAllCycles  = allContracts.filter((c) => c.companyId === id);
const companyItems      = contractOnboardingItems.filter((i) =>
  companyContracts.some((c) => c.id === i.contractId)        // ★ A
);
const companyStakeholders = stakeholders.filter((s) => s.companyId === id);
const companySuccessPlans = successPlans.filter((sp) =>
  companyAllCycles.some((c) => c.id === sp.contractId)       // ★ B
);
const companyJourneys     = accountJourneys.filter((j) => j.companyId === id);
```

#### 問題点

| # | 場所 | 問題 | Supabase化したときの挙動 |
|---|---|---|---|
| 1 | 全体 | リポジトリ層を経由していない (mock直import) | 監査ログ・構造化ログのフックが効かない、認可も効かない |
| 2 | ★A | `items.filter(.. contracts.some)` | 安直に直すと「契約数 N 回 `where contract_id = ?`」発動 |
| 3 | ★B | `successPlans.filter(.. allCycles.some)` | 同上 |
| 4 | 全体 | 9つの逐次評価 (`const x = ...; const y = ...;`) | mock では同期だが、repo化後に `await` を直列に置くと **遅延 9倍** |

#### 推奨修正

リポジトリ層 (01着地後) で下記に置き換える。`Promise.all` + 親IDの集合で `IN (...)` 一括取得:

```ts
const company = await companyRepo.getById(id);
if (!company) return notFound();

const [
  companyContacts,
  meetingLogsForCompany,
  contractsForCompany,
  stakeholdersForCompany,
  journeysForCompany,
] = await Promise.all([
  contactRepo.listByCompany(id),
  meetingLogRepo.listByCompany(id, { sort: 'date desc' }),
  contractRepo.listByCompany(id),                            // active + 履歴
  stakeholderRepo.listByCompany(id),
  accountJourneyRepo.listByCompany(id),
]);

const contractIds    = contractsForCompany.map((c) => c.id);
const activeContractIds = contractsForCompany
  .filter((c) => c.status === 'active' || c.status === 'onboarding')
  .map((c) => c.id);

// ★ N+1 を回避: contract_id IN (...) で1クエリ
const [onboardingItems, plans] = await Promise.all([
  onboardingItemRepo.listByContractIds(activeContractIds),   // 新メソッド (要01追加)
  successPlanRepo.listByContractIds(contractIds),            // 同
]);
```

#### 01側に追加してほしいリポジトリメソッド (01申し送り)

```ts
interface OnboardingItemRepo {
  listByContractIds(ids: string[]): Promise<ContractOnboardingItem[]>;
}
interface SuccessPlanRepo {
  listByContractIds(ids: string[]): Promise<SuccessPlan[]>;
}
interface MeetingLogRepo {
  listByCompany(companyId: string, opts?: { sort?: string; limit?: number }): Promise<MeetingLog[]>;
}
interface AccountJourneyRepo {
  listByCompany(companyId: string): Promise<AccountJourney[]>;
}
interface StakeholderRepo {
  listByCompany(companyId: string): Promise<Stakeholder[]>;
}
interface ContactRepo {
  listByCompany(companyId: string): Promise<Contact[]>;
}
```

→ いずれも `select * from <table> where <fk> = $1` または `where <fk> = ANY($1)` で1クエリに収まる。Supabase なら `.in('contract_id', ids)` 一発。

### 2-2. ✅ `app/team/page.tsx` (模範例)

```ts
const [users, allAssignments, companies, contracts, latestSnapshots] = await Promise.all([
  userRepo.list({ activeOnly: true }),
  assignmentRepo.list({ activeOnly: true }),
  companyRepo.list(),
  contractRepo.list({ activeOnly: true }),
  healthSnapshotRepo.latestAll(),                            // ← 重要: 全件最新を1クエリ
]);

const snapshotByContract = new Map(latestSnapshots.map((s) => [s.contractId, s]));
const userById          = new Map(users.map((u) => [u.id, u]));
const companyById       = new Map(companies.map((c) => [c.id, c]));
// ... stats.map 内は全て同期 (Map ルックアップ)
```

特筆事項:
- `healthSnapshotRepo.latestAll()` が**先回り集計クエリ**として用意されており、メンバー数 × 契約数 の N+1 を 1クエリに圧縮済。**好例**。
- `stats.map((u) => ...)` 内には await が一切ない。

→ **02のB項実装はN+1観点で模範**。今後の Server Component はこの構造をテンプレ化することを推奨 (`Promise.all` 並列 + Map index)。

### 2-3. ✅ `app/team/[userId]/one-on-one/page.tsx`

`Promise.all` 4並列。`oneOnOneLogRepo.list({ memberUserId })` が `where member_user_id = $1` 想定なので 1クエリで完了。

懸念点: `userRepo.list({ activeOnly: true })` を毎回フル取得している点。チームが 100名超になったら index hint or 部分取得 (organization_id 絞り) を入れる余地あり。**現状の規模ではOK**。

### 2-4. ✅ `app/companies/page.tsx`

"use client" + `lib/mock/*` 直 import の客体。SSR DB問い合わせなし。useMemo フィルタなのでクライアント計算のみ。

将来 "use server" 化や検索の DB 化が入るとき:
- `companies.filter` → `companyRepo.search({ q, healthColor, productCodes, owner })` に集約してDB側で WHERE
- `companyHealthColor(c.id)` を loop 内で呼んでいる箇所がもしDB化されるとN+1。**先回り集計 `latestAll()` パターン**を踏襲すること。

---

## 3. 横断ルール (このプロジェクトでの N+1 回避規約)

1. **Server Component の最初は必ず `Promise.all` で固定本数並列**。直列 await は禁止。
2. **ループ内の await は禁止**。事前に親キー集合を作って `listByXxxIds(ids: string[])` を呼ぶ。
3. **集計が必要なリストは「先回り集計クエリ」をリポジトリに用意**する (`latestAll()`, `countByOwner()` 等)。
4. **Map/Set による事前 index 化** を `.map`/`.forEach` の前に置く。配列 `.find`/`.filter` の入れ子は O(n×m) に化けるので避ける。
5. **新規 Server Component を作る前に、本ドキュメント §2-2 (team/page.tsx) を雛形として参照**。

---

## 4. 申し送り (ストリーム01へ)

下記リポジトリメソッドを追加してほしい (`/companies/[id]` 修正に必須):

| Repo | メソッド | クエリ |
|---|---|---|
| ContactRepo | `listByCompany(companyId)` | `where company_id = $1` |
| MeetingLogRepo | `listByCompany(companyId, opts?)` | `where company_id = $1 order by date desc limit ?` |
| StakeholderRepo | `listByCompany(companyId)` | `where company_id = $1` |
| AccountJourneyRepo | `listByCompany(companyId)` | `where company_id = $1` |
| OnboardingItemRepo | `listByContractIds(ids[])` | `where contract_id = any($1)` |
| SuccessPlanRepo | `listByContractIds(ids[])` | `where contract_id = any($1)` |

加えて、リポジトリ層で **「ループ内 await 検出」eslint custom rule** の導入を将来検討すると、再発防止が機械化できる。

---

## 5. 次回走査トリガ

下記イベントで再走査:

- 新規 Server Component / Server Action が `app/` 配下に追加されたとき
- 02のリポジトリ層 supabase 実装が「mockと差し替え可能」と判定された時 (実機でレイテンシ計測)
- 大規模な画面リファクタが行われた時

各回の差分は本ファイル末尾に追記する。

---

## 6. 関連

- [00_index.md](00_index.md)
- ストリーム02 D項 (解約予兆エンジン) — `churn_signals` 入り次第、解約一覧画面の N+1 走査を行う
- `reviews/16_SRE.md` (N+1 についての元レビュー)
- `roadmap/04_運用セキュリティ_完了報告.md` §8 (D項チェックリスト)
