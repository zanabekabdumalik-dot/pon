"""Озвучка сценария голосом Piper + тайминги фраз и слов для субтитров.

Реплики без "pause" читаются слитно: весь абзац синтезируется за один проход модели,
поэтому интонация и громкость не скачут между фразами. "pause" у реплики — жёсткая
пауза после неё (нужна анимации: барабанная дробь, обморок и т. п.) и конец абзаца.

Модель не отдаёт длительности фонем, поэтому границы предложений в слитной записи
находятся по естественным паузам — ближайшим к ожидаемым по отдельному синтезу.

Вход:  script.json, voices/<voice>.onnx
Выход: build/voice.wav (44.1 кГц), build/timeline.json
"""
import json
import re
import subprocess
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR_OUT = 44100
TAIL = 0.6
FRAME = 0.01  # шаг огибающей, сек

STRESS = "́"
END_PUNCT = {",": 2.5, "—": 2.5, ".": 4.0, "!": 4.0, "?": 4.0, "…": 4.0, ":": 3.0}


def envelope(audio, sr):
    win = int(sr * FRAME)
    n = len(audio) // win
    return np.abs(audio[: n * win]).reshape(n, win).max(axis=1)


def speech_bounds(audio, sr, thr=0.025):
    """Начало/конец речи по огибающей."""
    env = envelope(audio, sr)
    loud = np.where(env > thr * env.max())[0]
    if len(loud) == 0:
        return 0.0, len(audio) / sr
    return loud[0] * FRAME, (loud[-1] + 1) * FRAME


def silences(audio, sr, t0, t1, thr=0.03, min_len=0.05):
    """Паузы внутри речи [t0, t1]: список (начало, конец) в секундах."""
    env = envelope(audio, sr)
    quiet = env < thr * env.max()
    out, i, n = [], int(t0 / FRAME), min(len(env), int(t1 / FRAME))
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * FRAME >= min_len:
                out.append((i * FRAME, j * FRAME))
            i = j
        else:
            i += 1
    return out


def place_boundaries(lens, a, b, gaps, pause_bonus=1.0):
    """Выбирает паузы-границы между предложениями слитной записи.

    lens — длительности предложений при отдельном синтезе (задают пропорции),
    [a, b] — речь в слитной записи, gaps — найденные паузы. Динамическое
    программирование по парам соседних границ: каждое предложение сверяется по
    своей длительности (ошибка не накапливается), длинные паузы предпочтительнее
    (между предложениями модель делает паузы длиннее, чем на запятых)."""
    k, m = len(lens) - 1, len(gaps)
    if k == 0:
        return []
    if m < k:
        raise RuntimeError(f"в слитной записи {m} пауз, а нужно {k} границ предложений")
    r = max(0.3, b - a - 0.2 * k) / sum(lens)
    dur = lambda i, t0, t1: abs(np.log(max(t1 - t0, 0.05) / (lens[i] * r)))
    bonus = lambda g: pause_bonus * min(g[1] - g[0], 0.4)
    inf = float("inf")
    best = [[inf] * m for _ in range(k)]
    prev = [[-1] * m for _ in range(k)]
    for j in range(m):
        best[0][j] = dur(0, a, gaps[j][0]) - bonus(gaps[j])
    for i in range(1, k):
        for j in range(i, m):
            for jp in range(i - 1, j):
                c = best[i - 1][jp] + dur(i, gaps[jp][1], gaps[j][0]) - bonus(gaps[j])
                if c < best[i][j]:
                    best[i][j], prev[i][j] = c, jp
    j = min(range(k - 1, m), key=lambda x: best[k - 1][x] + dur(k, gaps[x][1], b))
    picked = []
    for i in range(k - 1, -1, -1):
        picked.append(gaps[j])
        j = prev[i][j]
    return picked[::-1]


def caption_words(text):
    """Разбивает подпись на слова; одиночные тире приклеиваются к предыдущему слову."""
    words = []
    for tok in text.replace(STRESS, "").split():
        if tok in ("—", "–", "-") and words:
            words[-1] += " —"
        else:
            words.append(tok)
    return words


def word_weights(word):
    letters = len(re.sub(r"[^\wё]", "", word, flags=re.I))
    tail = word.rstrip("»«\"'")
    pause = END_PUNCT.get(tail[-1], 0.0) if tail else 0.0
    return letters + 1.0, pause


def time_words(words, t0, t1):
    if not words:
        return []
    w = [word_weights(x) for x in words]
    units = sum(a for a, _ in w) + sum(p for _, p in w[:-1])
    k = (t1 - t0) / units
    out, cur = [], t0
    for word, (a, p) in zip(words, w):
        out.append({"w": word, "s": round(cur, 3), "e": round(cur + a * k, 3)})
        cur += (a + p) * k
    return out


def split_sentences(text):
    return [s for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if s]


def paragraphs(lines):
    """Группирует реплики в абзацы: абзац заканчивается на реплике с жёсткой паузой."""
    cur = []
    for line in lines:
        cur.append(line)
        if "pause" in line:
            yield cur, line["pause"]
            cur = []
    if cur:
        yield cur, 0.0


class Narrator:
    def __init__(self, script):
        self.voice = PiperVoice.load(str(HERE / "voices" / f"{script['voice']}.onnx"))
        self.cfg = SynthesisConfig(
            length_scale=script.get("length_scale", 1.0),
            noise_scale=script.get("noise_scale"),
            noise_w_scale=script.get("noise_w"),
        )
        self.sr = self.voice.config.sample_rate

    def phonemes(self, text):
        out = []
        for sent in self.voice.phonemize(text):
            if out:
                out.append(" ")
            out.extend(sent)
        return out

    def say(self, sentences):
        """Один проход модели по нескольким предложениям — слитная речь."""
        ph = []
        for s in sentences:
            if ph:
                ph.append(" ")
            ph.extend(self.phonemes(s))
        return self.voice.phoneme_ids_to_audio(self.voice.phonemes_to_ids(ph), self.cfg).astype(np.float32)

    def paragraph(self, sentences, attempts=5, tolerance=1.45):
        """Слитная запись абзаца + интервалы речи каждого предложения в ней.

        Синтез стохастический: если какое-то предложение после разметки вышло длиннее
        или короче ожидаемого больше чем в tolerance раз, абзац озвучивается заново,
        и берётся лучшая попытка."""
        if len(sentences) == 1:
            return self._take(sentences)[:2]
        lens = []
        for s in sentences:   # ожидаемые пропорции — по отдельному синтезу каждого предложения
            sa, sb = speech_bounds(self.say([s]), self.sr)
            lens.append(sb - sa)
        best = None
        for _ in range(attempts):
            audio, _, (a, b) = self._take(sentences)
            gaps = silences(audio, self.sr, a + 0.1, b - 0.1, min_len=0.1)
            if len(gaps) < len(sentences) - 1:
                gaps = silences(audio, self.sr, a + 0.1, b - 0.1, min_len=0.05)
            picked = place_boundaries(lens, a, b, gaps)
            spans = list(zip([a] + [g[1] for g in picked], [g[0] for g in picked] + [b]))
            r = sum(e - s for s, e in spans) / sum(lens)
            worst = max(abs(np.log((e - s) / (l * r))) for (s, e), l in zip(spans, lens))
            if best is None or worst < best[2]:
                best = (audio, spans, worst)
            if worst < np.log(tolerance):
                break
        return best[0], best[1]

    def _take(self, sentences):
        audio = self.say(sentences)
        a, b = speech_bounds(audio, self.sr)
        cut = max(0.0, a - 0.04)
        audio = audio[int(cut * self.sr): int(min(len(audio) / self.sr, b + 0.08) * self.sr)]
        a, b = a - cut, b - cut
        return audio, [(a, b)], (a, b)


def main():
    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    nar = Narrator(script)
    sr = nar.sr

    BUILD.mkdir(exist_ok=True)
    track = [np.zeros(int(script.get("lead_in", 0.3) * sr), dtype=np.float32)]
    cursor = len(track[0]) / sr
    lines = []

    for group, pause in paragraphs(script["lines"]):
        sents, owner = [], []
        for li, line in enumerate(group):
            for s in split_sentences(line["text"]):
                sents.append(s)
                owner.append(li)
        audio, spans = nar.paragraph(sents)

        for li, line in enumerate(group):
            own = [(cursor + s0, cursor + s1) for (s0, s1), o in zip(spans, owner) if o == li]
            caption = line.get("caption", line["text"]).replace(STRESS, "")
            cap_sents = split_sentences(caption)
            words = []
            if len(cap_sents) == len(own):
                for cs, (s0, s1) in zip(cap_sents, own):
                    words += time_words(caption_words(cs), s0, s1)
            else:
                words = time_words(caption_words(caption), own[0][0], own[-1][1])
            lines.append({
                "id": line["id"],
                "text": line["text"].replace(STRESS, ""),
                "start": round(own[0][0], 3),
                "end": round(own[-1][1], 3),
                "sentences": [[round(a, 3), round(b, 3)] for a, b in own],
                "words": words,
                "hide_caption": bool(line.get("hide_caption")),
            })

        gap = np.zeros(int(pause * sr), dtype=np.float32)
        track += [audio, gap]
        cursor += (len(audio) + len(gap)) / sr

    track.append(np.zeros(int(TAIL * sr), dtype=np.float32))
    voice_audio = np.concatenate(track)
    voice_audio = voice_audio / (np.abs(voice_audio).max() + 1e-9) * 0.89
    total = len(voice_audio) / sr

    raw = BUILD / "voice_22k.wav"
    with wave.open(str(raw), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes((voice_audio * 32767).astype(np.int16).tobytes())
    # обработка тембра не меняет тайминги (только фильтры; rubberband — лишь высоту тона)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ar", str(SR_OUT),
         "-af", script.get("voice_fx", "highpass=f=70"), str(BUILD / "voice.wav")],
        check=True,
    )

    timeline = {"title": script["title"], "total": round(total, 3), "lines": lines}
    (BUILD / "timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"voice: {total:.2f} c, реплик: {len(lines)}")
    for l in lines:
        sent = "  ".join(f"[{a:.2f}–{b:.2f}]" for a, b in l["sentences"]) if len(l["sentences"]) > 1 else ""
        print(f"  {l['id']:>4} {l['start']:6.2f}–{l['end']:6.2f}  {l['text']}  {sent}")


if __name__ == "__main__":
    main()
