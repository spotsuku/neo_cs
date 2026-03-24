# NEO ACADEMIA 福岡 第1期 Partner Success Dashboard

## Vercel へのデプロイ手順（推奨）

### 1. GitHubリポジトリを Vercel に連携

1. https://vercel.com にログイン
2. 「Add New Project」→ GitHubの `neo_cs` リポジトリを選択
3. 「Deploy」をクリック（この時点ではAI解析は未設定）

### 2. 環境変数（APIキー）を設定 ← **ここが重要**

Vercelのダッシュボードで設定します：

```
Vercel Dashboard
 → プロジェクト（neo_cs）を開く
   → 上部メニュー「Settings」
     → 左メニュー「Environment Variables」
       → 以下を追加：

Name:  ANTHROPIC_API_KEY
Value: sk-ant-あなたのAPIキー
```

> APIキーは https://console.anthropic.com/ → API Keys で取得

### 3. 再デプロイ

「Deployments」タブ → 最新のDeployment右の「…」→「Redeploy」

---

## ローカル開発

```bash
git clone https://github.com/spotsuku/neo_cs.git
cd neo_cs

# .env を作成
cp .env.example .env
# .env を開いて ANTHROPIC_API_KEY=sk-ant-... を設定

# サーバー起動（Node.js標準モジュールのみ・npm installは不要）
node server.js
# → http://localhost:3000
```

---

## ファイル構成

```
neo_cs/
├── index.html       ← ダッシュボード本体
├── server.js        ← ローカル開発用サーバー
├── vercel.json      ← Vercel設定（APIルーティング）
├── api/
│   └── claude.js    ← Anthropic APIプロキシ（Vercel Serverless Function）
├── package.json
├── .env             ← ローカル用APIキー（要作成・Git除外）
├── .env.example     ← .env のテンプレート
└── .gitignore       ← .env を除外設定済み
```

## AIが動く仕組み

```
ブラウザ（index.html）
    ↓  POST /api/claude
Vercel（api/claude.js が実行）
    ↓  APIキーをサーバー側で付与して転送
api.anthropic.com/v1/messages
    ↓  解析結果を返す
ブラウザ（インサイトバナーに表示・LocalStorageに保存）
```

APIキーはVercelの Environment Variables（サーバー側）に保管され、ブラウザには一切公開されません。
