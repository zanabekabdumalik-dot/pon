"""Финальная сборка: видео + звук. Громкость −16 LUFS — чуть тише стандарта YouTube (−14),
чтобы голос звучал мягче; YouTube тихие ролики не усиливает, только громкие приглушает."""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
BUILD = HERE / "build"
OUT = HERE / "out" / "fobiya-01-boyazn-dlinnyh-slov.mp4"
TARGET = -16.0


def loudness(path, af=None):
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path)]
    cmd += ["-af", (af + "," if af else "") + "ebur128=peak=true", "-f", "null", "-"]
    err = subprocess.run(cmd, capture_output=True, text=True, check=True).stderr
    summary = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    return i, peak


def main():
    stereo = "pan=stereo|c0=c0|c1=c0"   # моно-голос в оба канала без потери уровня
    i, _ = loudness(BUILD / "mix.wav", stereo)
    af = f"{stereo},volume={TARGET - i + 0.3:.2f}dB,alimiter=limit=0.84:attack=2:release=60:level=false"
    OUT.parent.mkdir(exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(BUILD / "video.mp4"), "-i", str(BUILD / "mix.wav"),
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", af + ",aresample=48000",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(OUT),
    ], check=True)
    i2, p2 = loudness(OUT)
    print(f"{OUT.relative_to(HERE)}: громкость {i2:.1f} LUFS, пик {p2:.1f} dBFS")
    if abs(i2 - TARGET) > 1.0:
        sys.exit(f"громкость {i2} далеко от {TARGET}")


if __name__ == "__main__":
    main()
