#!/usr/bin/env bash
# Сборка роликов: кадры → звук → mp4.   ./build.sh          — все три
#                                        ./build.sh 2        — только второй
#                                        ./build.sh --en     — английские титры (out/en, web/en)
# Нужно: node + npm, python3 + numpy, ffmpeg, Chromium (путь в $CHROMIUM).
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --silent
lang=ru
if [ "${1:-}" = "--en" ]; then lang=en; shift; fi
for v in "${@:-1 2 3}"; do
  for n in $v; do
    node render.js "$n" --lang "$lang"
    python3 audio.py "$n" "$lang"
    python3 mux.py "$n" "$lang"
  done
done
