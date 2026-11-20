#!/usr/bin/env bash
# Capture Chrome Web Store screenshots (1280x800) of store/shots/*.md with build/chrome-store loaded.
# Needs `chromium` and a server for store/shots; `npm run store:assets` starts one and sets BASE (default http://127.0.0.1:38765).
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${BASE:-http://127.0.0.1:38765}
E=$PWD/build/chrome-store; O=release/mt-md/store/shots; mkdir -p "$O"
shot() { # name doc [extra chromium flags]
  timeout 90 chromium --headless=new --no-sandbox --disable-extensions-except="$E" --load-extension="$E" \
    --user-data-dir="$(mktemp -d)" --window-size=1280,800 --virtual-time-budget=12000 "${@:3}" \
    --screenshot="$O/$1.png" "$BASE/$2.md" >/dev/null 2>&1
}
shot 1-overview overview
shot 2-diagrams diagrams
shot 3-math math
python3 scripts/store-shot-dark.py "$E" "$BASE/diagrams.md" "$O/4-dark.png"
