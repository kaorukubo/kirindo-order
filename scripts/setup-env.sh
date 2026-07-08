#!/usr/bin/env bash
# web/.env.local を .env.example から作成
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)/web"
EX="$WEB/.env.example"
LOCAL="$WEB/.env.local"

if [[ -f "$LOCAL" ]]; then
  echo "Already exists: $LOCAL"
  exit 0
fi

if [[ ! -f "$EX" ]]; then
  echo "Missing: $EX" >&2
  exit 1
fi

cp "$EX" "$LOCAL"
echo "Created: $LOCAL"
echo ""
echo "次: エディタで .env.local を開き、Supabase の3キーを設定してください"
echo "  取得元: Vercel → kirindo-order → Settings → Environment Variables"
echo "  または: Supabase Dashboard → Settings → API"
