"""Музыка и звуковые эффекты, синтезированные с нуля, + сведение с голосом.

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
rng = np.random.default_rng(7)


# ---------- примитивы ----------
def tt(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def filt(x, kind, f):
    sos = butter(2, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def glide(f0, f1, dur, curve="exp"):
    t = tt(dur)
    k = t / dur
    f = f0 * (f1 / f0) ** k if curve == "exp" else f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def attack(x, a=0.004):
    n = min(len(x), int(a * SR))
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    return x


def decay(dur, d):
    return np.exp(-tt(dur) / d)


def add(*xs):
    """Сумма сигналов разной длины."""
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[: len(x)] += x
    return out


# ---------- инструменты ----------
def marimba(f, vel=1.0, dur=0.7):
    t = tt(dur)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.32)
         + 0.3 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.05)
         + 0.08 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.015))
    return attack(y, 0.002) * vel


def bass_note(f, dur=0.5):
    t = tt(dur)
    y = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    return attack(y * np.exp(-t / 0.35), 0.01)


def kick():
    return glide(160, 45, 0.25) * decay(0.25, 0.09)


def clap():
    return filt(noise(0.15), "bandpass", [900, 3500]) * decay(0.15, 0.035)


def shaker():
    return filt(noise(0.06), "highpass", 6000) * decay(0.06, 0.015)


# ---------- эффекты ----------
def sfx_pop(pitch=1.0):
    return glide(950 * pitch, 320 * pitch, 0.09) * decay(0.09, 0.03) * 0.5


def sfx_click(pitch=1.0):
    t = tt(0.03)
    return (np.sin(2 * np.pi * 1700 * pitch * t) * 0.6 + filt(noise(0.03), "highpass", 3000) * 0.5) * decay(0.03, 0.006)


def sfx_tick(pitch=1.0):
    t = tt(0.06)
    f = 1100 * pitch
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * decay(0.06, 0.018) * 0.7


def sfx_boom():
    return add(glide(110, 38, 0.9) * decay(0.9, 0.3), filt(noise(0.5), "lowpass", 400) * decay(0.5, 0.12) * 0.8)


def sfx_drone(dur):
    t = tt(dur)
    y = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(55, 0), (82.4, 1), (110.6, 2), (164.8, 0.5)])
    y *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t)
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.4)
    return filt(y, "lowpass", 600) * env * 0.25


def sfx_boing():
    t = tt(0.6)
    f = 180 + 260 * (t / 0.6) + 70 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.3)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * decay(0.6, 0.22) * 0.8


def sfx_thud(gain=1.0):
    return add(glide(120, 45, 0.3) * decay(0.3, 0.08), filt(noise(0.2), "lowpass", 300) * decay(0.2, 0.05) * 0.6) * gain


def sfx_sparkle():
    out = np.zeros(int(0.8 * SR))
    for i in range(9):
        s = int((0.06 * i + rng.uniform(0, 0.03)) * SR)
        b = np.sin(2 * np.pi * rng.uniform(2200, 4200) * tt(0.12)) * decay(0.12, 0.03)
        out[s:s + len(b)] += b * 0.35
    return out


def sfx_riser(dur):
    t = tt(dur)
    k = t / dur
    n = filt(noise(dur), "bandpass", [300, 5000]) * k ** 2
    tone = glide(180, 720, dur) * k ** 1.5 * 0.35
    return (n * 0.5 + tone) * 0.8


def sfx_whistle(dur):
    t = tt(dur)
    return glide(2000, 700, dur) * np.minimum(1, t / 0.05) * 0.35


def sfx_impact():
    return add(sfx_boom() * 1.2, sfx_crash()[: int(0.9 * SR)] * 0.5)


def sfx_panic():
    t = tt(0.9)
    f = np.where(np.sin(2 * np.pi * 7 * t) > 0, 880, 660)
    y = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5
    return filt(y, "lowpass", 2500) * np.minimum(1, (0.9 - t) / 0.2) * 0.35


def sfx_drumroll(dur):
    out = np.zeros(int(dur * SR) + SR)
    hits = int(dur * 26)
    for i in range(hits):
        s = int((i / 26 + rng.uniform(-0.004, 0.004)) * SR)
        g = 0.25 + 0.75 * (i / max(1, hits - 1)) ** 1.5
        h = (filt(noise(0.09), "bandpass", [1200, 6000]) + 0.4 * np.sin(2 * np.pi * 190 * tt(0.09))) * decay(0.09, 0.03)
        out[max(0, s):max(0, s) + len(h)] += h * g * 0.6
    return out[: int(dur * SR)]


def sfx_crash():
    t = tt(1.4)
    metal = sum(np.sin(2 * np.pi * f * t) for f in (3200, 4510, 5870, 7300)) * 0.08
    return (filt(noise(1.4), "highpass", 4000) + metal) * np.exp(-t / 0.35) * 0.7


def sfx_tada(gain=1.0):
    def brass(freqs, dur):
        t = tt(dur)
        y = sum(sum(np.sin(2 * np.pi * f * h * t) / h for h in range(1, 7)) for f in freqs)
        env = np.minimum(1, t / 0.03) * np.exp(-t / (dur * 0.7))
        return filt(y, "lowpass", 3000) * env * 0.18
    ta = brass([523.3, 659.3, 784.0], 0.16)
    da = brass([523.3, 659.3, 784.0, 1046.5], 0.6)
    out = np.zeros(int(1.4 * SR))
    out[: len(ta)] += ta
    s = int(0.17 * SR)
    out[s:s + len(da)] += da
    return out * gain


def sfx_slide(dur):
    t = tt(dur)
    f = 1500 * (300 / 1500) ** (t / dur) * (1 + 0.03 * np.sin(2 * np.pi * 9 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.45


def sfx_tweet():
    out = np.zeros(int(1.2 * SR))
    for i in range(5):
        c = glide(2600, 3900, 0.07) * decay(0.07, 0.03) * 0.35
        s = int((i * 0.22 + (0.08 if i % 2 else 0)) * SR)
        out[s:s + len(c)] += c
    return out


def sfx_stamp():
    return add(sfx_thud(1.2), filt(noise(0.12), "bandpass", [600, 2500]) * decay(0.12, 0.03) * 0.8)


def sfx_whoosh(gain=1.0):
    dur = 0.5
    t = tt(dur)
    n = noise(dur)
    out = np.zeros_like(n)
    for i, f in enumerate(np.linspace(600, 3500, 8)):  # грубый «свип» полосами
        w = np.exp(-((t / dur - i / 7) ** 2) / 0.02)
        out += filt(n, "bandpass", [f * 0.7, f * 1.3]) * w
    return out * np.sin(np.pi * t / dur) * 0.6 * gain


def sfx_ding():
    t = tt(1.6)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in [(1318.5, 1, 0.8), (2637, 0.4, 0.4), (3950, 0.2, 0.2)])
    return attack(y) * 0.45


def sfx_snore(dur):
    out = np.zeros(int(dur * SR))
    cyc = 1.7
    for k in range(int(dur / cyc) + 1):
        s = int(k * cyc * SR)
        t = tt(0.9)
        buzz = filt(noise(0.9), "lowpass", 500) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t)))
        inhale = buzz * np.sin(np.pi * t / 0.9) ** 2 * 0.6
        t2 = tt(0.6)
        exhale = glide(900, 650, 0.6) * np.sin(np.pi * t2 / 0.6) * 0.12
        seg = np.concatenate([inhale, exhale])
        e = min(len(out), s + len(seg))
        if s < len(out):
            out[s:e] += seg[: e - s]
    return out


SFX = {
    "pop": lambda c: sfx_pop(c.get("pitch", 1)), "click": lambda c: sfx_click(c.get("pitch", 1)),
    "tick": lambda c: sfx_tick(c.get("pitch", 1)), "boom": lambda c: sfx_boom(),
    "drone": lambda c: sfx_drone(c["dur"]), "boing": lambda c: sfx_boing(), "thud": lambda c: sfx_thud(),
    "sparkle": lambda c: sfx_sparkle(), "riser": lambda c: sfx_riser(c["dur"]),
    "whistle": lambda c: sfx_whistle(c["dur"]), "impact": lambda c: sfx_impact(), "panic": lambda c: sfx_panic(),
    "drumroll": lambda c: sfx_drumroll(c["dur"]), "crash": lambda c: sfx_crash(), "tada": lambda c: sfx_tada(),
    "slide": lambda c: sfx_slide(c["dur"]), "tweet": lambda c: sfx_tweet(), "stamp": lambda c: sfx_stamp(),
    "whoosh": lambda c: sfx_whoosh(), "ding": lambda c: sfx_ding(), "snore": lambda c: sfx_snore(c["dur"]),
}


# ---------- музыка ----------
def music(total):
    bpm = 112
    beat = 60 / bpm
    out = np.zeros(int((total + 2) * SR))

    def put(x, t, g=1.0):
        s = int(t * SR)
        e = min(len(out), s + len(x))
        if s < len(out):
            out[s:e] += x[: e - s] * g

    note = lambda m: 440 * 2 ** ((m - 69) / 12)
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]   # C Am F G
    roots = [36, 33, 29, 31]
    arp = [0, 1, 2, 1, 2, 3, 2, 1]
    melody = [79, None, 76, 79, 81, None, 79, None, 76, None, 74, 76, 72, None, None, None,
              77, None, 76, 74, 72, None, 74, None, 76, None, 79, None, 74, None, None, None]
    bar = 4 * beat
    nbars = int(total / bar) + 2
    for b in range(nbars):
        t0 = b * bar
        ch, root = chords[b % 4], roots[b % 4]
        tones = ch + [ch[0] + 12]
        for i, idx in enumerate(arp):
            put(marimba(note(tones[idx] + 12), 0.5 + 0.2 * (i % 2 == 0)), t0 + i * beat / 2)
        for k in (0, 2):
            put(bass_note(note(root + 12)), t0 + k * beat, 0.9)
            put(kick(), t0 + k * beat, 0.9)
        put(bass_note(note(root + 19), 0.3), t0 + 3.5 * beat, 0.5)
        for k in (1, 3):
            put(clap(), t0 + k * beat, 0.35)
        for k in range(8):
            put(shaker(), t0 + k * beat / 2 + beat / 4, 0.25)
        if b % 8 >= 4:   # мелодия во второй половине каждого цикла
            half = (b % 2) * 16
            for i in range(8):
                m = melody[half + i * 2]
                if m:
                    put(marimba(note(m), 0.6, 0.8), t0 + i * beat / 2)
    out = filt(out, "highpass", 40)
    return out[: int(total * SR)] / (np.abs(out).max() + 1e-9)


def gain_curve(cues, total):
    n = int(total * SR)
    g = np.zeros(n)
    events = sorted([c for c in cues if c["type"] == "music"], key=lambda c: c["t"])
    cur = 0.0
    pos = 0
    for c in events:
        s = int(c["t"] * SR)
        g[pos:s] = cur
        f = max(1, int(c["fade"] * SR))
        e = min(n, s + f)
        g[s:e] = np.linspace(cur, c["gain"], f)[: e - s]
        cur = c["gain"]
        pos = e
    g[pos:] = cur
    return g


def envelope(x, att=0.02, rel=0.35):
    a = np.abs(x)
    win = int(0.02 * SR)
    a = np.convolve(a, np.ones(win) / win, mode="same")
    # медленный спад после реплики: макс-фильтр на rel секунд
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

    sfx = np.zeros(n + 3 * SR)
    for c in cues:
        if c["type"] == "music":
            continue
        x = SFX[c["type"]](c) * c.get("gain", 1.0)
        s = max(0, int(c["t"] * SR))
        sfx[s:s + len(x)] += x
    sfx = sfx[:n]

    mus = music(total) * gain_curve(cues, total)
    env = envelope(voice)
    speaking = np.clip(env / (env.max() * 0.25 + 1e-9), 0, 1)

    mix = voice * 1.0 + mus * 0.2 * (1 - 0.55 * speaking) + sfx * 0.38 * (1 - 0.4 * speaking)
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)   # мягкий лимитер
    mix /= np.abs(mix).max() / 0.95
    with wave.open(str(BUILD / "mix.wav"), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(f"mix: {total:.2f} c, эффектов: {sum(c['type'] != 'music' for c in cues)}")


if __name__ == "__main__":
    main()
