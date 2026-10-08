#!/usr/bin/env bash
# Wrap app.html (the published artifact body) into a standalone index.html you can open in any browser.
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<style>html,body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat app.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "index.html built"
