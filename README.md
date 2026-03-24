# NEO ACADEMIA 福岡 第1期 Partner Success Dashboard

## セットアップ手順

### 1. Node.js の確認（v16以上）
```bash
node --version
```

### 2. APIキーの設定
```bash
cp .env.example .env
```
`.env` を開いて `ANTHROPIC_API_KEY` に取得したAPIキーを設定：
```
ANTHROPIC_API_KEY=sk-ant-あなたのキー
```
> APIキーは https://console.anthropic.com/ で取得できます

### 3. サーバー起動
```bash
node server.js
```
または
```bash
npm start
```

### 4. ブラウザで開く
```
http://localhost:3000
```

---

## ファイル構成

```
neo_ps_dashboard/
├── index.html       ← ダッシュボード本体（すべての機能）
├── server.js        ← 静的ファイル配信 + APIプロキシサーバー
├── api/
│   └── claude.js    ← Anthropic APIプロキシ（CORSを回避）
├── package.json
├── .env             ← APIキー設定（要作成 / Gitにコミット禁止）
├── .env.example     ← .env のテンプレート
└── .gitignore
```

## AI解析機能について

`定例面談` タブの **AI解析インサイト** 機能は、サーバー経由でAnthropicのAPIを呼び出します。

- ブラウザ → `POST /api/claude` → `server.js` → `api/claude.js` → Anthropic API
- APIキーはサーバー側（`.env`）で管理されるため、ブラウザには公開されません
- 解析結果は LocalStorage に蓄積保存され、ページをリロードしても維持されます

## 注意事項

- `.env` ファイルは絶対にGitにコミットしないでください
- 本番運用時は `ALLOWED_ORIGIN` を適切なドメインに設定してください
