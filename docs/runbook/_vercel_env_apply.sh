#!/bin/bash
# Vercel Production 環境変数 一括設定スクリプト
# 使い方:
#   1. 下記の VARS の値を全て埋める (空欄のままだと skip される)
#   2. bash docs/runbook/_vercel_env_apply.sh production
#   3. vercel env ls production で確認
#
# Preview用に流す場合は引数 'preview' を渡す
# このスクリプトはコミットしてはいけない (シークレットを書くため) — .gitignore に追加済の想定
# テンプレとして配置しているが、値を入れた版は別途ローカル管理すること

set -e

ENV=${1:-production}
cd "$(dirname "$0")/../../neo-cs-v2"

add_env() {
  local NAME=$1
  local VALUE=$2
  local SENSITIVE=${3:-false}
  if [ -z "$VALUE" ]; then
    echo "[skip] $NAME (空欄)"
    return
  fi
  if [ "$SENSITIVE" = "true" ]; then
    vercel env add "$NAME" "$ENV" --value "$VALUE" --yes --sensitive 2>&1 | tail -1
  else
    vercel env add "$NAME" "$ENV" --value "$VALUE" --yes 2>&1 | tail -1
  fi
  echo "[ok]   $NAME"
}

# ============================================================
# 1-A. Supabase
# ============================================================
add_env NEXT_PUBLIC_SUPABASE_URL          ""  false
add_env NEXT_PUBLIC_SUPABASE_ANON_KEY     ""  true
add_env SUPABASE_SERVICE_ROLE_KEY         ""  true
add_env SUPABASE_PROJECT_REF              ""  false

# ============================================================
# 1-B. Anthropic
# ============================================================
add_env ANTHROPIC_API_KEY                 ""  true

# ============================================================
# 1-C. Google OAuth
# ============================================================
add_env GOOGLE_CLIENT_ID                  ""  false
add_env GOOGLE_CLIENT_SECRET              ""  true
add_env GOOGLE_HOSTED_DOMAIN              "neoacademia.jp"  false

# ============================================================
# 1-D. Slack Webhooks (4本)
# ============================================================
add_env SLACK_WEBHOOK_URL_CHURN_ALERTS    ""  true
add_env SLACK_WEBHOOK_URL_EXPANSION       ""  true
add_env SLACK_WEBHOOK_URL_VOC             ""  true
add_env SLACK_WEBHOOK_URL_INCIDENTS       ""  true

# ============================================================
# 1-E. Sentry
# ============================================================
add_env SENTRY_DSN                        ""  true

# ============================================================
# 1-F. アプリ設定
# ============================================================
add_env INITIAL_ADMIN_EMAIL               ""  false
add_env NEO_CS_V2_URL                     ""  false
add_env NEXT_PUBLIC_APP_BASE_URL          ""  false
add_env ALLOWED_ORIGINS                   ""  false
add_env REPO_DRIVER                       "supabase"  false
add_env NOTIFICATION_DEDUP_DRIVER         "supabase"  false
add_env LOG_LEVEL                         "info"  false

# ============================================================
# 1-G. CRON (32文字以上のランダム文字列)
# 未設定の場合 openssl で生成して echo
# ============================================================
if [ -z "$CRON_SECRET_VALUE" ]; then
  CRON_SECRET_VALUE=$(openssl rand -hex 32)
  echo "[gen]  CRON_SECRET = $CRON_SECRET_VALUE  ※安全に保管すること"
fi
add_env CRON_SECRET "$CRON_SECRET_VALUE" true

echo ""
echo "完了。確認: vercel env ls $ENV"
