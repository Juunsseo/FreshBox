#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")" && pwd)"
backend_dir="$project_root/freshbox-backend"
frontend_dir="$project_root/freshbox-frontend"

if [[ ! -x "$backend_dir/.venv/bin/python" ]]; then
  python3 -m venv "$backend_dir/.venv"
  "$backend_dir/.venv/bin/python" -m pip install -e "$backend_dir[dev]"
fi

[[ -f "$backend_dir/.env" ]] || cp "$backend_dir/.env.example" "$backend_dir/.env"
[[ -f "$frontend_dir/.env.local" ]] || cp "$frontend_dir/.env.example" "$frontend_dir/.env.local"

if [[ ! -d "$frontend_dir/node_modules" ]]; then
  (cd "$frontend_dir" && npm ci)
fi

(cd "$backend_dir" && "$backend_dir/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env) &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT INT TERM

cd "$frontend_dir"
npm run dev

