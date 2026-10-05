#!/usr/bin/env bash
# Полная сборка ролика: озвучка → кадры → звук → mp4.
# Нужно: python3 (piper-tts, numpy, scipy), node + npm, ffmpeg, Chromium (путь в $CHROMIUM).
set -euo pipefail
cd "$(dirname "$0")"

VOICE=voices/ru-irinia-medium.onnx
if [ ! -f "$VOICE" ]; then
  mkdir -p voices build
  curl -sSL -o build/voice.tar.gz https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-ru-irinia-medium.tar.gz
  tar xzf build/voice.tar.gz -C voices
fi
[ -d node_modules ] || npm install --silent

python3 tts.py
node render.js
python3 audio.py
python3 mux.py
