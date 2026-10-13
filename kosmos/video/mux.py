"""Финальная сборка ролика: видео + звук, громкость −16 LUFS.
Кроме полной версии 1080×1920 для YouTube Shorts делает лёгкую версию 720×1280 и обложку для сайта.

    python3 mux.py 1        # английская версия: python3 mux.py 1 en → out/en/, web/en/
"""
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
BUILD = HERE / "build"
OUT = HERE / "out"
WEB = HERE / "web"
TARGET = -16.0
POSTER_T = {1: 16.6, 2: 16.0, 3: 18.6}


def loudness(path, af=None):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path)]
    cmd += ["-af", (af + "," if af else "") + "ebur128=peak=true", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True, check=True).stderr
    summary = err[err.rfind("Summary:"):]
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))


def run(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *map(str, args)], check=True)


def main(vid, lang="ru"):
    tag = f"v{vid}" + ("" if lang == "ru" else f"-{lang}")
    info = json.loads((BUILD / f"{tag}.json").read_text())
    prefix = "kosmos" if lang == "ru" else "event-horizon"
    name = f"{prefix}-{vid:02d}-{info['slug']}"
    out = OUT if lang == "ru" else OUT / lang
    webdir = WEB if lang == "ru" else WEB / lang
    out.mkdir(parents=True, exist_ok=True)
    webdir.mkdir(parents=True, exist_ok=True)
    i = loudness(BUILD / f"{tag}-mix.wav")
    af = f"volume={TARGET - i:.2f}dB,alimiter=limit=0.89:attack=2:release=60:level=false,aresample=48000"
    full = out / f"{name}.mp4"
    run("-i", BUILD / f"{tag}.mp4", "-i", BUILD / f"{tag}-mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", af, "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", full)
    web = webdir / f"{prefix}-{vid:02d}.mp4"
    run("-i", full, "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", web)
    run("-ss", POSTER_T[vid], "-i", full, "-frames:v", "1", "-vf", "scale=720:1280:flags=lanczos", "-q:v", "4", webdir / f"{prefix}-{vid:02d}.jpg")
    print(f"{full.relative_to(HERE)}: {loudness(full):.1f} LUFS, {full.stat().st_size / 1e6:.1f} МБ; "
          f"{web.relative_to(HERE)}: {web.stat().st_size / 1e6:.1f} МБ")


if __name__ == "__main__":
    main(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else "ru")
