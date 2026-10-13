"""Финальная сборка ролика: видео + звук, громкость −16 LUFS.
Кроме полной версии 1080×1920 для YouTube Shorts делает лёгкую версию 720×1280 и обложку для сайта.

    python3 mux.py 1
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


def main(vid):
    info = json.loads((BUILD / f"v{vid}.json").read_text())
    name = f"kosmos-{vid:02d}-{info['slug']}"
    OUT.mkdir(exist_ok=True)
    WEB.mkdir(exist_ok=True)
    i = loudness(BUILD / f"v{vid}-mix.wav")
    af = f"volume={TARGET - i:.2f}dB,alimiter=limit=0.89:attack=2:release=60:level=false,aresample=48000"
    full = OUT / f"{name}.mp4"
    run("-i", BUILD / f"v{vid}.mp4", "-i", BUILD / f"v{vid}-mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
        "-af", af, "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", full)
    web = WEB / f"kosmos-{vid:02d}.mp4"
    run("-i", full, "-vf", "scale=720:1280:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", web)
    run("-ss", POSTER_T[vid], "-i", full, "-frames:v", "1", "-vf", "scale=720:1280:flags=lanczos", "-q:v", "4", WEB / f"kosmos-{vid:02d}.jpg")
    print(f"{full.relative_to(HERE)}: {loudness(full):.1f} LUFS, {full.stat().st_size / 1e6:.1f} МБ; "
          f"{web.relative_to(HERE)}: {web.stat().st_size / 1e6:.1f} МБ")


if __name__ == "__main__":
    main(int(sys.argv[1]))
