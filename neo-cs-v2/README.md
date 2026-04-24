# NEO CS v2 (Integration Demo)

仕様ディスカッション用のデモアプリ。ダミーデータで画面のみ確認する。

## スタック

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v3
- React 19

## デザイン

- ベース: 白背景、Liquid Design（すりガラス・柔らかい層）
- アクセント: NEO ブランドのレインボーグラデーション（ポイント使用のみ）
- 研修ごとのアクセントカラー: ACADEMIA=青 / 評議会=紫 / AIKEN=緑 / コミュマネ=橙

## 起動

```bash
cd neo-cs-v2
npm install
npm run dev
# → http://localhost:3000
```

## ディレクトリ

```
app/                 App Router ページ
  layout.tsx         全体レイアウト
  page.tsx           トップダッシュボード
  globals.css
components/          共有UI
  TopNav.tsx
  KpiCard.tsx
  ProductBadge.tsx
  MrrSparkline.tsx
  BrandMark.tsx
lib/mock/
  data.ts            ダミーデータ
```

## 実装済み画面

- [x] トップダッシュボード（全体タブ）

## 今後の実装予定

- [ ] 研修別ダッシュボード（切替タブ）
- [ ] 企業一覧 / 企業カルテ
- [ ] 契約詳細（セッション・出欠）
- [ ] オンボ管理
- [ ] 設定（研修マスタ編集）
```
