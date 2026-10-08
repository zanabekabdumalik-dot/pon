#!/usr/bin/env bash
# Build Peremena.exe for Windows 10/11 x64: one small file, uses the system WebView2 (Edge) engine.
# usage: ./build.sh <out_dir>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(mkdir -p "$1" && cd "$1" && pwd)"
(cd "$here/../.." && ./build.sh >/dev/null)
cp "$here/../../index.html" "$here/resources/index.html"
cp "$here/icon.png" "$here/resources/icon.png"
cd "$here"
npm install --no-audit --no-fund
npx neu update
npx neu build --release --embed-resources
cp dist/Peremena/Peremena-win_x64.exe "$out/Peremena.exe"
ls -la "$out/Peremena.exe"
