"""Эмбиент глубины и звуковые эффекты, синтезированные с нуля, + сведение с голосом.

Музыка — три слоя (светлый у поверхности, сумеречный, тёмный у дна), их громкость
следует кривой глубины из cues.json, поэтому звук «темнеет» вместе с картинкой.

Вход:  build/voice.wav, build/timeline.json, build/cues.json (метки из anim.html)
Выход: build/mix.wav
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR = 44100
VOICE_RMS_DB = -19.0
BOTTOM = 10935
rng = np.random.default_rng(11)


# ---------- примитивы ----------
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def glide(f0, f1, dur, curve="exp"):
    t = tt(dur)
    k = t / dur
    f = f0 * (f1 / f0) ** k if curve == "exp" else f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def decay(dur, d):
    return np.exp(-tt(dur) / d)


def attack(x, a=0.004):
    n = min(len(x), int(a * SR))
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    return x


def fade(x, a=0.01, r=0.05):
    x = x.copy()
    na, nr = min(len(x), int(a * SR)), min(len(x), int(r * SR))
    x[:na] *= np.linspace(0, 1, na)
    x[len(x) - nr:] *= np.linspace(1, 0, nr)
    return x


def add(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[: len(x)] += x
    return out


def echo(x, delays=(0.11, 0.23, 0.37, 0.53), fb=0.45, tail=1.2):
    """Простая «пещерная» реверберация: несколько затухающих отражений."""
    out = np.concatenate([x, np.zeros(int(tail * SR))])
    for i, d in enumerate(delays):
        s = int(d * SR)
        seg = out[s:s + len(x)]
        seg += (filt(x, "lowpass", 2500 - i * 400) * fb ** (i + 1))[: len(seg)]
    return out


# ---------- эффекты ----------
def sfx_tick(pitch=1.0):
    t = tt(0.08)
    f = 1500 * pitch
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.4 * t)) * decay(0.08, 0.02) * 0.6


def sfx_waves(dur):
    n = filt(noise(dur), "bandpass", [250, 2200])
    t = tt(dur)
    env = 0.55 + 0.45 * np.sin(2 * np.pi * 0.35 * t) ** 2
    gull = np.zeros_like(n)
    for s in (0.6, 1.9):
        c = glide(1700, 1250, 0.35) * np.sin(np.pi * tt(0.35) / 0.35) * 0.12
        i = int(s * SR)
        gull[i:i + len(c)] += c[: len(gull) - i]
    return fade(n * env * 0.5 + gull, 0.2, 0.6)


def sfx_splash():
    body = filt(noise(1.2), "bandpass", [300, 6000]) * decay(1.2, 0.25)
    low = glide(140, 50, 0.6) * decay(0.6, 0.2) * 0.9
    return add(body * 0.9, low, sfx_bubbles(1.4) * 0.8)


def sfx_bubbles(dur):
    out = np.zeros(int(dur * SR) + SR // 2)
    n = int(dur * 22)
    for i in range(n):
        s = int(rng.uniform(0, dur) * SR)
        f0 = rng.uniform(400, 1300)
        d = rng.uniform(0.03, 0.07)
        b = glide(f0, f0 * 1.9, d) * decay(d, d / 3) * rng.uniform(0.2, 0.5)
        out[s:s + len(b)] += b
    env = np.exp(-np.arange(len(out)) / SR / (dur * 0.6))
    return out * env


def sfx_sonar(pitch=1.0):
    f = 1180 * pitch
    t = tt(1.6)
    ping = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t / 0.35)
    return echo(attack(ping, 0.003) * 0.5, delays=(0.42, 0.85), fb=0.35, tail=1.0)


def sfx_swish():
    dur = 1.1
    t = tt(dur)
    n = filt(noise(dur), "lowpass", 500)
    return n * np.sin(np.pi * t / dur) ** 2 * 0.9 + glide(90, 60, dur) * np.sin(np.pi * t / dur) * 0.3


def sfx_lights():
    clunk = add(filt(noise(0.06), "bandpass", [800, 4000]) * decay(0.06, 0.012), glide(220, 120, 0.1) * decay(0.1, 0.03))
    t = tt(0.9)
    hum = (np.sign(np.sin(2 * np.pi * 100 * t)) * 0.12 + np.sin(2 * np.pi * 50 * t) * 0.2) * np.exp(-t / 0.4)
    hum *= np.where((t > 0.08) & (t < 0.16), 0.1, 1.0)
    return add(clunk, filt(hum, "lowpass", 1200) * 0.7)


def sfx_sting(low=0):
    """Резкий «ужасный» аккорд: диссонанс пилой с тремоло."""
    dur = 2.2
    t = tt(dur)
    base = [110, 116.5, 155.6, 233] if low else [220, 233, 311, 466]
    y = sum(2 * (t * f % 1) - 1 for f in base) / len(base)
    y *= 1 + 0.35 * np.sin(2 * np.pi * 9 * t)
    y = filt(y, "lowpass", 2400 if not low else 1200)
    env = np.minimum(1, t / 0.01) * np.exp(-t / 0.7)
    hit = add(filt(noise(0.3), "lowpass", 300) * decay(0.3, 0.08), glide(80, 40, 0.5) * decay(0.5, 0.15))
    return echo(add(y * env * 0.7, hit * 0.8), tail=1.4)


def sfx_whale():
    """Протяжный низкий зов кита."""
    dur = 3.2
    t = tt(dur)
    f = 155 + 70 * np.sin(np.pi * t / dur) - 40 * (t / dur) ** 2 + 4 * np.sin(2 * np.pi * 5 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    y = filt(y, "bandpass", [100, 900])
    env = np.sin(np.pi * t / dur) ** 1.5
    return echo(y * env * 0.6, delays=(0.3, 0.7, 1.1), fb=0.5, tail=2.0)


def sfx_boom():
    return echo(add(glide(90, 32, 1.6) * decay(1.6, 0.5), filt(noise(1.0), "lowpass", 200) * decay(1.0, 0.3) * 0.8), tail=1.5)


def sfx_groan():
    """Металлический стон корпуса."""
    dur = 1.8
    t = tt(dur)
    f = 70 + 30 * np.sin(2 * np.pi * 0.7 * t) + 18 * np.sin(2 * np.pi * 3.1 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = (ph / (2 * np.pi)) % 1 * 2 - 1
    y = add(filt(saw, "bandpass", [180, 700]) * 0.8, filt(saw, "bandpass", [1200, 1700]) * 0.25)
    grit = (rng.uniform(size=len(t)) < 0.002) * rng.uniform(-1, 1, len(t))
    y = y[: len(t)] * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 1.3 * t))) + filt(grit, "bandpass", [500, 3000]) * 2
    return echo(fade(y, 0.15, 0.4) * 0.6, tail=1.2)


def sfx_heart(dur):
    """Сердцебиение, ускоряется от 64 до 104 ударов в минуту."""
    out = np.zeros(int((dur + 1) * SR))
    t = 0.0
    while t < dur:
        bpm = 64 + 40 * (t / dur) ** 1.3
        g = 0.55 + 0.45 * t / dur
        for dt, a in ((0, 1.0), (0.17, 0.7)):
            b = glide(65, 42, 0.16) * decay(0.16, 0.05) * a * g
            s = int((t + dt) * SR)
            out[s:s + len(b)] += b
        t += 60 / bpm
    return filt(out, "lowpass", 300) * 1.3


def sfx_boop():
    return add(glide(500, 1100, 0.12) * decay(0.12, 0.06) * 0.6, glide(800, 1500, 0.1) * decay(0.1, 0.04) * 0.3)


def sfx_thud():
    return add(glide(110, 38, 0.5) * decay(0.5, 0.14), filt(noise(0.3), "lowpass", 350) * decay(0.3, 0.07) * 0.8)


def sfx_dust():
    dur = 2.4
    t = tt(dur)
    return filt(noise(dur), "lowpass", 700) * np.minimum(1, t / 0.05) * np.exp(-t / 0.7) * 0.6


def sfx_crack():
    snap = filt(noise(0.05), "highpass", 1500) * decay(0.05, 0.008) * 1.2
    tinkle = np.zeros(int(0.8 * SR))
    for i in range(10):
        s = int(rng.uniform(0.02, 0.4) * SR)
        f = rng.uniform(3000, 7000)
        b = np.sin(2 * np.pi * f * tt(0.12)) * decay(0.12, 0.025) * 0.25
        tinkle[s:s + len(b)] += b
    body = glide(300, 120, 0.25) * decay(0.25, 0.06) * 0.5
    return echo(add(snap, tinkle, body), tail=0.8)


def sfx_whistle():
    t = tt(0.45)
    return glide(1800, 500, 0.45) * np.minimum(1, t / 0.05) * 0.3


def sfx_alarm(dur):
    out = np.zeros(int(dur * SR))
    period = 0.45
    k = 0
    while k * period < dur:
        f = 880 if k % 2 == 0 else 660
        b = np.sign(np.sin(2 * np.pi * f * tt(0.22))) * 0.25
        b = filt(b, "lowpass", 2200) * np.minimum(1, (0.22 - tt(0.22)) / 0.02) * np.minimum(1, tt(0.22) / 0.01)
        s = int(k * period * SR)
        out[s:s + len(b)] += b[: len(out) - s]
        k += 1
    return out


def sfx_whoosh():
    dur = 0.8
    t = tt(dur)
    n = noise(dur)
    out = np.zeros_like(n)
    for i, f in enumerate(np.linspace(300, 3000, 8)):
        w = np.exp(-((t / dur - i / 7) ** 2) / 0.02)
        out += filt(n, "bandpass", [f * 0.7, f * 1.3]) * w
    return out * np.sin(np.pi * t / dur) * 0.7


def sfx_rumble(dur):
    t = tt(dur)
    y = filt(noise(dur), "lowpass", 160) * 1.6 + glide(45, 70, dur) * 0.5
    return y * np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.4)


def sfx_ding():
    t = tt(1.6)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(1318.5, 1, 0.8), (2637, 0.4, 0.4), (3950, 0.2, 0.2)])
    return attack(y) * 0.45


def sfx_pop():
    return glide(900, 320, 0.09) * decay(0.09, 0.03) * 0.5


SFX = {
    "tick": lambda c: sfx_tick(c.get("pitch", 1)), "waves": lambda c: sfx_waves(c["dur"]),
    "splash": lambda c: sfx_splash(), "bubbles": lambda c: sfx_bubbles(c["dur"]),
    "sonar": lambda c: sfx_sonar(c.get("pitch", 1)), "swish": lambda c: sfx_swish(),
    "lights": lambda c: sfx_lights(), "sting": lambda c: sfx_sting(c.get("low", 0)),
    "whale": lambda c: sfx_whale(), "boom": lambda c: sfx_boom(), "groan": lambda c: sfx_groan(),
    "heart": lambda c: sfx_heart(c["dur"]), "boop": lambda c: sfx_boop(), "thud": lambda c: sfx_thud(),
    "dust": lambda c: sfx_dust(), "crack": lambda c: sfx_crack(), "whistle": lambda c: sfx_whistle(),
    "alarm": lambda c: sfx_alarm(c["dur"]), "whoosh": lambda c: sfx_whoosh(),
    "rumble": lambda c: sfx_rumble(c["dur"]), "ding": lambda c: sfx_ding(), "pop": lambda c: sfx_pop(),
}


# ---------- музыка ----------
note = lambda m: 440 * 2 ** ((m - 69) / 12)


def pad(freqs, n, detune=0.004, bright=0.5):
    """Мягкий пэд: слегка расстроенные пилы и синусы, медленное дыхание."""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for d in (-detune, 0, detune):
            ph = t * f * (1 + d) + rng.uniform()
            y += (np.sin(2 * np.pi * ph) * (1 - bright) + (2 * (ph % 1) - 1) * bright) / 3
    return y / len(freqs)


def music(total, depth_curve):
    n = int((total + 1) * SR)
    t = np.arange(n) / SR
    breath = 0.75 + 0.25 * np.sin(2 * np.pi * t / 7.0)

    # светлый слой у поверхности: Dm(add9) + мерцающие колокольчики
    light = filt(pad([note(m) for m in (50, 57, 62, 65, 69)], n, bright=0.35), "lowpass", 2600) * breath
    bells = np.zeros(n)
    seq = [74, 77, 81, 76, 74, 72, 69, 72]
    for i in range(int(total / 0.75) + 1):
        s = int(i * 0.75 * SR)
        b = np.sin(2 * np.pi * note(seq[i % len(seq)]) * tt(1.4)) * np.exp(-tt(1.4) / 0.5) * 0.25
        bells[s:s + len(b)] += b[: n - s]
    light += echo(bells, tail=0)[:n] * 0.6

    # сумеречный слой: тот же аккорд ниже и глуше, редкие низкие ноты
    mid = filt(pad([note(m) for m in (38, 45, 50, 53, 57)], n, bright=0.5), "lowpass", 900) * breath
    for i in range(int(total / 4) + 1):
        s = int(i * 4 * SR)
        m = [50, 48, 46, 45][i % 4]
        b = np.sin(2 * np.pi * note(m) * tt(3.5)) * np.sin(np.pi * tt(3.5) / 3.5) * 0.35
        mid[s:s + len(b)] += b[: n - s]

    # тёмный слой: гул, диссонанс (малая секунда) и инфранизкое дрожание
    dark = filt(pad([note(m) for m in (26, 33, 38, 39)], n, bright=0.6), "lowpass", 320)
    dark += filt(noise(n / SR), "lowpass", 90) * 0.8
    dark *= 0.7 + 0.3 * np.sin(2 * np.pi * t / 5.3)

    # громкость слоёв по глубине
    ct = np.array([c["t"] for c in depth_curve])
    cd = np.array([c["d"] for c in depth_curve])
    d = np.interp(t, ct, cd)
    g_light = np.clip(1 - d / 250, 0, 1)
    g_mid = np.clip(d / 150, 0, 1) * np.clip(1 - (d - 1500) / 2500, 0, 1)
    g_dark = np.clip((d - 600) / 2500, 0, 1)

    def norm(x):
        return x / (np.sqrt(np.mean(x ** 2)) + 1e-9)

    out = norm(light) * g_light * 0.8 + norm(mid) * g_mid * 0.9 + norm(dark) * g_dark * 1.0
    out = filt(out, "highpass", 30)
    return out[: int(total * SR)] / (np.abs(out).max() + 1e-9)


def gain_curve(cues, total):
    n = int(total * SR)
    g = np.zeros(n)
    events = sorted([c for c in cues if c["type"] == "music"], key=lambda c: c["t"])
    cur, pos = 0.0, 0
    for c in events:
        s = int(c["t"] * SR)
        g[pos:s] = cur
        f = max(1, int(c["fade"] * SR))
        e = min(n, s + f)
        g[s:e] = np.linspace(cur, c["gain"], f)[: e - s]
        cur, pos = c["gain"], e
    g[pos:] = cur
    return g


def envelope(x, rel=0.35):
    a = np.abs(x)
    win = int(0.02 * SR)
    a = np.convolve(a, np.ones(win) / win, mode="same")
    step = int(0.01 * SR)
    frames = a[: len(a) // step * step].reshape(-1, step).max(axis=1)
    k = int(rel / 0.01)
    held = np.array([frames[max(0, i - k):i + 1].max() for i in range(len(frames))])
    env = np.repeat(held, step)
    return np.pad(env, (0, len(x) - len(env)), mode="edge")


def read_wav(path):
    with wave.open(str(path)) as f:
        assert f.getframerate() == SR
        return np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def main():
    tl = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    cues = json.loads((BUILD / "cues.json").read_text(encoding="utf-8"))
    total = tl["total"]
    n = int(total * SR)

    voice = np.zeros(n)
    v = read_wav(BUILD / "voice.wav")[:n]
    voice[: len(v)] = v
    speech = np.concatenate([voice[int(l["start"] * SR):int(l["end"] * SR)] for l in tl["lines"]])
    voice *= 10 ** (VOICE_RMS_DB / 20) / (np.sqrt(np.mean(speech ** 2)) + 1e-9)

    sfx = np.zeros(n + 4 * SR)
    count = 0
    for c in cues:
        if c["type"] in ("music", "depth"):
            continue
        x = SFX[c["type"]](c) * c.get("gain", 1.0)
        s = max(0, int(c["t"] * SR))
        sfx[s:s + len(x)] += x
        count += 1
    sfx = sfx[:n]

    depth_curve = [c for c in cues if c["type"] == "depth"]
    mus = music(total, depth_curve) * gain_curve(cues, total)
    env = envelope(voice)
    speaking = np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)

    mix = voice * 1.0 + mus * 0.24 * (1 - 0.5 * speaking) + sfx * 0.4 * (1 - 0.35 * speaking)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix /= np.abs(mix).max() / 0.95
    with wave.open(str(BUILD / "mix.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(f"mix: {total:.2f} c, эффектов: {count}")


if __name__ == "__main__":
    main()
