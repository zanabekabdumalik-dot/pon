#!/usr/bin/env bash
# Build Peremena-<version>-portable.exe (Windows x64, no install needed) from Linux.
# usage: ./build.sh <out_dir>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(mkdir -p "$1" && cd "$1" && pwd)"
(cd "$here/../.." && ./build.sh >/dev/null)
cp "$here/../../index.html" "$here/index.html"
cd "$here"
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install --no-audit --no-fund
npx electron-builder --win portable --x64
cp dist/Peremena-*-portable.exe "$out/"
ls -la "$out"/Peremena-*-portable.exe
