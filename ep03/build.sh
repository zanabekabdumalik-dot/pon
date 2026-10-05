#!/usr/bin/env bash
# Полная сборка ролика: озвучка → кадры → звук → mp4.
# Нужно: python3 (piper-tts, numpy, scipy), node + npm, ffmpeg, Chromium (путь в $CHROMIUM).
set -euo pipefail
cd "$(dirname "$0")"

VOICE=$(python3 -c "import json; print(json.load(open('script.json'))['voice'])")
if [ ! -f "voices/$VOICE.onnx" ]; then
  # голоса Piper, зеркало на GitHub (sherpa-onnx): ru_RU-irina-medium, ru_RU-dmitri-medium, ...
  mkdir -p voices build
  curl -sSL -o build/voice.tar.bz2 "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-$VOICE.tar.bz2"
  tar xjf build/voice.tar.bz2 -C build
  mv "build/vits-piper-$VOICE/$VOICE.onnx" "build/vits-piper-$VOICE/$VOICE.onnx.json" voices/
fi
[ -d node_modules ] || npm install --silent

python3 tts.py
node render.js
python3 audio.py
python3 mux.py
