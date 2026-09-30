#!/usr/bin/env python3
"""Generate the game's Mandarin prompts with Qwen3-TTS on Apple Silicon.

Run from the project root with:
  uv run --python 3.12 --with mlx-audio python tools/generate_qwen_voice.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from mlx_audio.tts.utils import load_model
from scipy.io import wavfile


MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit"
STYLE = (
    "请像一位温柔自然的年轻女性，面对熟悉的小朋友轻声引导游戏。"
    "标准普通话，语气亲近有笑意，语速轻快但不着急，停顿简短，"
    "句尾干净，表达真实克制。"
)

PROMPTS = {
    "welcome": "欢迎来到派派的快乐小鸡乐园！",
    "menu": "请选择一个游戏吧。",
    "egg": "点一下蓝色画面，快乐小鸡就会到那里下蛋。也可以按空格键。",
    "maze": "选一条迷宫。从小鸡这里拖动，画一条种子路线到鸡舍。",
    "coop": "鸡蛋可以提前拖进鸡舍。孵化以后，要在小鸡跑掉以前，把它送回正确颜色的家。",
    "puddle": "先选一个泥坑，再连续点击，让佩奇或者乔治跳起来。",
    "puzzle": "先选一幅图，再选择四片、九片或者十六片。拖近正确位置，拼图片就会自动吸住。",
    "stickers": "把贴纸从下面拖到画面里。贴纸可以用很多次，拖回贴纸栏就会删除。",
    "start": "开始啦！",
    "countdown": "三、二、一！",
    "timeup": "时间到！",
    "success": "成功啦！",
    "tryagain": "没关系，再试一次！",
    "reward": "你获得了一枚新贴纸！",
    "rotate": "请把设备横过来。",
}


def trim_and_normalize(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    samples = np.asarray(audio, dtype=np.float32).reshape(-1)
    if not samples.size:
        return samples

    active = np.flatnonzero(np.abs(samples) >= 10 ** (-48 / 20))
    if active.size:
        padding = int(sample_rate * 0.075)
        start = max(0, int(active[0]) - padding)
        stop = min(samples.size, int(active[-1]) + padding + 1)
        samples = samples[start:stop].copy()

    peak = float(np.max(np.abs(samples))) if samples.size else 0
    if peak > 0:
        samples *= 0.82 / peak

    fade_length = min(int(sample_rate * 0.012), samples.size // 2)
    if fade_length:
        fade = np.linspace(0, 1, fade_length, dtype=np.float32)
        samples[:fade_length] *= fade
        samples[-fade_length:] *= fade[::-1]
    return samples


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("assets/audio/voice-qwen"))
    parser.add_argument("--only", choices=sorted(PROMPTS), help="Generate one prompt only")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    prompts = {args.only: PROMPTS[args.only]} if args.only else PROMPTS
    model = load_model(MODEL)

    for key, text in prompts.items():
        results = list(model.generate_custom_voice(
            text=text,
            speaker="Serena",
            language="Chinese",
            instruct=STYLE,
            verbose=False,
        ))
        if len(results) != 1:
            raise RuntimeError(f"{key}: expected one audio segment, received {len(results)}")
        result = results[0]
        audio = trim_and_normalize(np.asarray(result.audio), result.sample_rate)
        destination = args.output_dir / f"{key}.wav"
        pcm = np.round(np.clip(audio, -1, 1) * 32767).astype(np.int16)
        wavfile.write(destination, result.sample_rate, pcm)
        print(f"{key:10s} {len(audio) / result.sample_rate:5.2f}s  {text}")


if __name__ == "__main__":
    main()
