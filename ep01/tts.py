"""Озвучка сценария голосом Piper + тайминги фраз и слов для субтитров.

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
SENTENCE_GAP = 0.22  # пауза между предложениями внутри одной реплики, сек
TAIL = 0.6

STRESS = "́"
END_PUNCT = {",": 2.5, "—": 2.5, ".": 4.0, "!": 4.0, "?": 4.0, "…": 4.0, ":": 3.0}


def speech_bounds(audio, sr, thr=0.025):
    """Начало/конец речи по огибающей (окна по 10 мс)."""
    win = int(sr * 0.01)
    n = len(audio) // win
    env = np.abs(audio[: n * win]).reshape(n, win).max(axis=1)
    loud = np.where(env > thr * env.max())[0]
    if len(loud) == 0:
        return 0.0, len(audio) / sr
    return loud[0] * win / sr, (loud[-1] + 1) * win / sr


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


def main():
    script = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    voice = PiperVoice.load(str(HERE / "voices" / f"{script['voice']}.onnx"))
    cfg = SynthesisConfig(
        length_scale=script.get("length_scale", 1.0),
        noise_scale=script.get("noise_scale"),
        noise_w_scale=script.get("noise_w"),
    )
    sr = voice.config.sample_rate

    BUILD.mkdir(exist_ok=True)
    track = [np.zeros(int(script.get("lead_in", 0.3) * sr), dtype=np.float32)]
    cursor = len(track[0]) / sr
    lines = []

    for line in script["lines"]:
        caption = line.get("caption", line["text"]).replace(STRESS, "")
        sentences = split_sentences(line["text"])
        cap_sentences = split_sentences(caption)
        if len(cap_sentences) != len(sentences):
            cap_sentences = [caption]  # подпись не совпадает по предложениям — тайминг целиком
        seg_bounds, parts = [], []
        for i, sent in enumerate(sentences):
            audio = np.concatenate(
                [c.audio_float_array for c in voice.synthesize(sent, syn_config=cfg)]
            ).astype(np.float32)
            a, b = speech_bounds(audio, sr)
            cut = max(0.0, a - 0.03)
            audio = audio[int(cut * sr): int(min(len(audio) / sr, b + 0.06) * sr)]
            start = cursor + sum(len(p) for p in parts) / sr
            seg_bounds.append((start + a - cut, start + b - cut))
            parts.append(audio)
            if i < len(sentences) - 1:
                parts.append(np.zeros(int(SENTENCE_GAP * sr), dtype=np.float32))

        clip = np.concatenate(parts)
        speech_start, speech_end = seg_bounds[0][0], seg_bounds[-1][1]
        words = []
        if len(cap_sentences) == len(seg_bounds):
            for cs, (s0, s1) in zip(cap_sentences, seg_bounds):
                words += time_words(caption_words(cs), s0, s1)
        else:
            words = time_words(caption_words(caption), speech_start, speech_end)

        lines.append({
            "id": line["id"],
            "text": line["text"].replace(STRESS, ""),
            "start": round(speech_start, 3),
            "end": round(speech_end, 3),
            "sentences": [[round(a, 3), round(b, 3)] for a, b in seg_bounds],
            "words": words,
            "hide_caption": bool(line.get("hide_caption")),
        })
        track.append(clip)
        pause = np.zeros(int(line.get("pause", 0.3) * sr), dtype=np.float32)
        track.append(pause)
        cursor += (len(clip) + len(pause)) / sr

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
    # обработка тембра (мягкость, тон) не меняет тайминги: rubberband сдвигает только высоту
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
        print(f"  {l['id']:>4} {l['start']:6.2f}–{l['end']:6.2f}  {l['text']}")


if __name__ == "__main__":
    main()
