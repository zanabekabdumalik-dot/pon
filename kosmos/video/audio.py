"""Музыка и звуковые эффекты для роликов, синтезированные с нуля (только numpy).

Вход:  build/v<N>.json — длительность и метки звуков, которые записал render.js
Выход: build/v<N>-mix.wav (стерео, 44.1 кГц)

    python3 audio.py 1
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR = 44100
rng = np.random.default_rng(42)


# ---------- примитивы ----------
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def fft_filter(x, lo=None, hi=None, order=2):
    """Мягкий фильтр в частотной области: lo — срез снизу, hi — срез сверху (Гц)."""
    n = len(x)
    if n == 0:
        return x
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if hi:
        m /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        m *= 1 - 1 / np.sqrt(1 + (np.maximum(f, 1e-9) / lo) ** (2 * order))
    return np.fft.irfft(X * m, n)


def decay(dur, d):
    return np.exp(-tt(dur) / d)


def fade(x, a=0.005, b=0.02):
    x = x.copy()
    na, nb = min(len(x), int(a * SR)), min(len(x), int(b * SR))
    if na:
        x[:na] *= np.linspace(0, 1, na)
    if nb:
        x[-nb:] *= np.linspace(1, 0, nb)
    return x


def glide(f0, f1, dur):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------- инструменты ----------
def pad_chord(freqs, dur, bright=1400):
    """Мягкий пэд: несколько гармоник, расстройка между каналами, медленное «дыхание»."""
    t = tt(dur)
    out = np.zeros((2, len(t)))
    for i, f in enumerate(freqs):
        for ch, det in enumerate((0.9985, 1.0015)):
            lfo = 0.75 + 0.25 * np.sin(2 * np.pi * (0.07 + 0.013 * i) * t + i * 1.7 + ch)
            vib = 1 + 0.0015 * np.sin(2 * np.pi * 4.2 * t + i)
            s = np.zeros(len(t))
            for k in range(1, 6):
                s += np.sin(2 * np.pi * f * det * k * np.cumsum(vib) / SR + k * i) / k ** 1.4
            out[ch] += s * lfo / len(freqs)
    return np.stack([fft_filter(out[0], hi=bright), fft_filter(out[1], hi=bright)])


def pad(chords, total, xf=2.0, bright=1400):
    """Последовательность аккордов с плавными переходами на всю длину ролика."""
    seg = total / len(chords)
    out = np.zeros((2, int(total * SR) + SR))
    for i, ch in enumerate(chords):
        start = max(0.0, i * seg - xf / 2)
        dur = seg + xf
        x = pad_chord(ch, dur, bright)
        n = x.shape[1]
        w = np.ones(n)
        k = int(xf * SR)
        w[:k] = np.sin(np.linspace(0, np.pi / 2, k)) ** 2
        w[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
        s = int(start * SR)
        e = min(out.shape[1], s + n)
        out[:, s:e] += (x * w)[:, : e - s]
    return out[:, : int(total * SR)]


def bell(f, dur=2.5):
    t = tt(dur)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 1.2), (2.0, 0.4, 0.7), (2.76, 0.25, 0.45), (5.4, 0.12, 0.2)))
    return fade(s, 0.002, 0.05)


def tick(level=1.0):
    d = 0.05
    s = np.sin(2 * np.pi * 1900 * tt(d)) * decay(d, 0.006) + fft_filter(noise(d), lo=3000) * decay(d, 0.004) * 0.5
    return fade(s, 0.0005, 0.005) * level


def blip(level=1.0):
    d = 0.18
    f = rng.uniform(1250, 1750)
    s = np.sin(2 * np.pi * f * tt(d)) * decay(d, 0.04) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt(d)) * decay(d, 0.02)
    return fade(s, 0.001, 0.02) * level


def whoosh(dur=1.3, level=1.0):
    n = noise(dur)
    t = tt(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    low, high = fft_filter(n, lo=150, hi=700), fft_filter(n, lo=900, hi=5000)
    return fade((low * (1 - e) + high * e) * e, 0.01, 0.05) * level


def boom(level=1.0, dur=3.0):
    s = glide(75, 28, dur) * decay(dur, 0.9) + fft_filter(noise(dur), hi=260) * decay(dur, 0.45) * 1.6
    return fade(s, 0.003, 0.2) * level


def impact(level=1.0):
    d = 2.2
    s = glide(110, 35, d) * decay(d, 0.6) + fft_filter(noise(d), hi=1600) * decay(d, 0.3) * 1.2
    return fade(s, 0.002, 0.2) * level


def riser(dur=2.1, level=1.0):
    t = tt(dur)
    k = (t / dur) ** 2
    s = glide(60, 420, dur) * 0.5 * k + fft_filter(noise(dur), lo=400, hi=6000) * k * 0.8
    return fade(s, 0.05, 0.01) * level


def rumble(dur=3.5, level=1.0):
    t = tt(dur)
    e = np.minimum(1, t / 0.6) * np.exp(-np.maximum(0, t - 1.4) / 1.0)
    s = fft_filter(noise(dur), hi=180) * 2.2 + fft_filter(noise(dur), lo=800, hi=4000) * 0.25 * (rng.uniform(0, 1, len(t)) > 0.995)
    return fade(s * e, 0.01, 0.2) * level


def beep(level=1.0):
    d = 0.09
    one = np.sin(2 * np.pi * 1320 * tt(d)) + 0.3 * np.sin(2 * np.pi * 3960 * tt(d))
    one = fade(one, 0.003, 0.02)
    gap = np.zeros(int(0.05 * SR))
    return np.concatenate([one, gap, one]) * level


def chime(level=1.0):
    s = np.zeros(int(3.2 * SR))
    for i, f in enumerate((659.3, 987.8, 1318.5)):
        b = bell(f, 2.8) * (0.7 ** i)
        o = int(i * 0.12 * SR)
        s[o:o + len(b)] += b[: len(s) - o]
    return s * level


def swell(level=1.0):
    d = 1.6
    t = tt(d)
    s = glide(55, 45, d) * np.exp(-t / 0.7) + fft_filter(noise(d), lo=2000, hi=9000) * np.exp(-t / 0.5) * 0.25
    return fade(s, 0.004, 0.2) * level


SFX = {
    "tick": (tick, 0.38), "hit": (blip, 0.32), "whoosh": (whoosh, 0.35), "boom": (boom, 0.95),
    "impact": (impact, 0.8), "fall": (riser, 0.5), "launch": (rumble, 0.45), "beep": (beep, 0.25),
    "sweep": (lambda level: whoosh(0.7, level), 0.3), "chime": (chime, 0.35), "swell": (swell, 0.4),
}

# Аккорды: тёмный ля минор, загадочный ре минор, светлый до мажор
CHORDS = {
    1: [[55, 82.41, 110, 130.81, 164.81], [43.65, 65.41, 87.31, 110, 130.81], [73.42, 110, 146.83, 174.61], [82.41, 123.47, 164.81, 207.65]],
    2: [[73.42, 110, 174.61, 329.63], [58.27, 87.31, 146.83, 220], [49, 73.42, 116.54, 220], [55, 82.41, 138.59, 196]],
    3: [[65.41, 98, 164.81, 246.94], [55, 82.41, 130.81, 196], [43.65, 65.41, 110, 164.81], [49, 73.42, 123.47, 146.83], [65.41, 98, 164.81, 246.94]],
}


def place(mix, x, t, pan=0.0):
    s = int(t * SR)
    if s >= mix.shape[1]:
        return
    x = x[: mix.shape[1] - s]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[0, s:s + len(x)] += x * l * 1.41
    mix[1, s:s + len(x)] += x * r * 1.41


def sparkle(mix, chords, total, every, level, start=1.0, stop=None):
    """Тихие колокольчики из нот текущего аккорда."""
    stop = stop or total - 2
    seg = total / len(chords)
    t = start
    while t < stop:
        ch = chords[min(len(chords) - 1, int(t / seg))]
        f = ch[rng.integers(1, len(ch))] * 4
        while f > 1800:
            f /= 2
        place(mix, bell(f, 2.2) * level, t, rng.uniform(-0.6, 0.6))
        t += every * rng.uniform(0.8, 1.25)


def build(vid):
    info = json.loads((BUILD / f"v{vid}.json").read_text())
    total = info["dur"]
    n = int(total * SR)
    mix = np.zeros((2, n))

    p = pad(CHORDS[vid], total, bright=1100 if vid == 1 else 1500)
    env = np.ones(n)
    k = int(2.5 * SR)
    env[:k] = np.linspace(0, 1, k) ** 1.5
    env[-int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR))
    mix += p * env * 0.32

    if vid == 1:
        # гул нарастает по мере приближения, обрывается во тьме перед заставкой
        t = tt(total)
        g = np.clip(t / 25.4, 0, 1) ** 2 * 0.35 + np.clip((t - 25.4) / 2.1, 0, 1) ** 2 * 0.8
        g *= t < 27.6
        rum = fft_filter(noise(total), hi=90) * 3 + np.sin(2 * np.pi * 36 * t) * 0.4
        mix += np.stack([rum * g, rum * g]) * 0.5
        duck = np.ones(n)
        a, b = int(27.5 * SR), int(28.1 * SR)
        duck[a:b] = 0.15
        duck[b:min(n, b + int(1.2 * SR))] = np.linspace(0.15, 1, min(n, b + int(1.2 * SR)) - b)
        mix *= duck
        sparkle(mix, CHORDS[1], total, 2.6, 0.05, 1.5, 25)
    if vid == 2:
        # «дождь» попаданий, когда электронов много
        t = tt(total)
        g = np.interp(t, [0, 10, 12.5, 17.6, 18.2, 21.2, 22.8, 26.4, 27], [0, 0, 0.4, 0.4, 0, 0, 0.4, 0.4, 0])
        rain = fft_filter(noise(total) * (rng.uniform(0, 1, n) > 0.97), lo=2500, hi=9000)
        mix += np.stack([rain * g, np.roll(rain, 300) * g]) * 0.5
        sparkle(mix, CHORDS[2], total, 1.8, 0.06, 1.0, 27)
    if vid == 3:
        sparkle(mix, CHORDS[3], total, 1.3, 0.07, 4.5, 32)

    for c in info["cues"]:
        if c["type"] not in SFX:
            continue
        fn, lvl = SFX[c["type"]]
        place(mix, fn(lvl * c.get("v", 1)), c["t"], rng.uniform(-0.3, 0.3) if c["type"] in ("hit", "tick") else 0.0)

    peak = np.max(np.abs(mix)) or 1
    mix = mix / peak * 0.89
    out = (np.clip(mix, -1, 1) * 32767).astype(np.int16).T
    with wave.open(str(BUILD / f"v{vid}-mix.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out.tobytes())
    print(f"v{vid}-mix.wav: {total:.1f} с, {len(info['cues'])} меток")


if __name__ == "__main__":
    build(int(sys.argv[1]))
