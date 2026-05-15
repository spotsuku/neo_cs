# DESIGN SYSTEM — NEO CS ポータル

> 「**デモ画面では綺麗だったのに本番で崩れる**」を二度と起こさないためのルール集。

---

## 1. なぜ崩れたのか (仮説)

1. **mock データが UI に都合の良い長さ・件数で揃っていた**
   - 企業名・担当者名が全て短い / null フィールドが無い / 配列が必ず 3〜5 件
   - 本番では空配列 / null / 長文 / 0 件 / 100 件 などが普通に来る
2. **コンポーネントが固定幅・固定高さで作られている**
   - `w-48` 決め打ちで日本語の長い社名が折り返さない / はみ出る
3. **`undefined` 安全でない**
   - `a.b.c` で b が null になり得るのに optional chaining なし
4. **画像/avatar のフォールバックなし**
   - Supabase 側に画像 URL が未設定で `<img src="">` になる
5. **デザイントークンが定まっていない**
   - 同じ意味の色・余白に複数の Tailwind クラスが混在し、画面ごとに見た目が変わる

→ Phase 1 で UI 監査を行い `PARITY.md` に具体ファイルを列挙する。

---

## 2. 採用しているデザイン基盤

- **Tailwind 3** ([tailwind.config.ts](../neo-cs-v2/tailwind.config.ts))
- **shadcn 風 UI** ([components/ui/](../neo-cs-v2/components/ui/))
- スタイルガイド画面: [/styleguide](../neo-cs-v2/app/(system)/styleguide/) (実装の生きた仕様)

---

## 3. デザイントークン

| トークン | 用途 | Tailwind |
|---|---|---|
| Brand primary | アクション / ハイライト | TBD |
| **Status: healthy** | 健全 | **blue-500** (`#3B82F6`) |
| **Status: watch** | 進行中 / 要観察 | **yellow-500** (`#EAB308`) |
| **Status: risk** | 危険 | **red-500** (`#EF4444`) |
| Status: churn | 解約 | gray-500 |
| Surface (bg) | カード / パネル | TBD |
| Border subtle / strong | 境界線 | TBD |
| Text primary / muted / disabled | 文字色 | TBD |
| Spacing scale | 余白 (4/8/12/16/24/32) | Tailwind デフォルトに準拠 |
| Radius | 角丸 (sm/md/lg) | TBD |
| Shadow | 階層 (none/sm/md) | TBD |

→ `tailwind.config.ts` で `theme.extend.colors` に定義し、画面側はトークン名のみ参照する。**生の hex / `gray-XXX` の使用禁止**。

---

## 4. 守るべきルール (Don't ship without these)

### 4.1 文字列の長さ
- 社名・人名・タイトル系は **truncate + tooltip / title 属性** を必ず付ける、または `break-words` を許可する
- 固定 `w-NN` は使わず、`min-w-0` + flex の縮退を使う
- テーブルセルは `max-w-[Nch]` + truncate

### 4.2 空状態 / null
- 配列が 0 件のときの empty state を必ず実装 (`EmptyState` コンポーネント想定)
- `?.` で optional chaining を強制 (TypeScript の strictNullChecks 前提)
- avatar / 画像は `<Avatar fallback>` パターン (頭文字 or プレースホルダ)

### 4.3 数値・日付
- 数値は `Intl.NumberFormat` 経由、桁区切り必須
- 日付は `formatJst` などのユーティリティ経由 (TZ ずれ防止)
- 「未設定」は `—` (em dash) で統一

### 4.4 状態 (Status) の表現
- ヘルススコア / 契約状態 / オンボ状態は **Badge コンポーネント + 色トークン**で固定
- 自由に色を選ばない

### 4.5 レスポンシブ
- 最小サポート幅: TBD (1280px? 1024px?)
- テーブルはモバイル幅で横スクロール許容

---

## 5. UI 変更を出すときのチェックリスト

PR テンプレ ([PARALLEL_WORK.md](PARALLEL_WORK.md) と一緒に整備) に組み込む:

- [ ] mock データを長文・空配列・null に差し替えても崩れない
- [ ] `REPO_DRIVER=supabase` で実 DB に接続した状態でも見た目が同じ (実環境スクショ添付)
- [ ] `/styleguide` のサンプルを更新 (新規パターンを追加した場合)
- [ ] dark mode (採用するなら) で確認
- [ ] キーボード操作 / フォーカスリング (a11y)

---

## 6. これから決めること (Phase 0 残タスク)

- [ ] カラートークン値の確定
- [ ] ヘルススコア状態色の確定 (healthy/watch/risk/churn → 緑/黄/赤/灰?)
- [ ] EmptyState / ErrorState / LoadingState の共通コンポーネント有無を確認
- [ ] Avatar フォールバックの実装方針
- [ ] 数値・日付フォーマッタが既にあるか確認 → 一本化
- [ ] 最小サポート画面幅
