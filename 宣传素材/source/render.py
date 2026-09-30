"""Render a short, local promotional film from isolated game footage."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
BUILD = ROOT / "edit"
BUILD.mkdir(exist_ok=True)
FFMPEG = os.environ.get("FFMPEG_BIN") or shutil.which("ffmpeg")
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"
W, H = 1920, 1080
BG = (21, 47, 82)
BG_LIGHT = (29, 70, 111)
WHITE = (250, 251, 247)
MUTED = (198, 220, 233)
YELLOW = (255, 219, 74)
PINK = (239, 85, 124)
SKY = (66, 173, 231)

CHAPTERS = {
    "home": (
        "六步，从会点到会拖。",
        "把鼠标动作拆成孩子看得懂、愿意重复的小游戏。",
        "能力路线",
    ),
    "egg": (
        "第一步：看准，再单击。",
        "点击位置决定母鸡落点，练习指针定位和手眼配合。",
        "单击定位",
    ),
    "puddle": (
        "第二步：选目标，连续点。",
        "先选泥坑，再保持点击节奏，让动作更稳定。",
        "连续点击",
    ),
    "coop": (
        "第三步：抓住、拖动、松开。",
        "把鸡蛋和小鸡送回鸡舍，练习一次完整的拖放。",
        "基础拖放",
    ),
    "maze": (
        "第四步：按住，不要松手。",
        "沿通道画出路线，练习连续控制与避开边界。",
        "路径控制",
    ),
    "puzzle": (
        "第五步：拖得更准。",
        "把拼图片送到正确位置，练习空间判断和精细放置。",
        "精准放置",
    ),
    "stickers": (
        "第六步：把方法用起来。",
        "自由布置贴纸，在创作中迁移已经掌握的鼠标动作。",
        "自由运用",
    ),
}


def run(arguments: list[object]) -> None:
    if not FFMPEG:
        raise RuntimeError("FFmpeg was not found. Set FFMPEG_BIN to its executable path.")
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *map(str, arguments)],
        check=True,
    )


def font(size: int, light: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(LIGHT if light else FONT, size)


def write_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    content: str,
    size: int,
    color: tuple[int, int, int] = WHITE,
    *,
    center: bool = False,
    light: bool = False,
) -> None:
    selected = font(size, light)
    x, y = xy
    if center:
        x -= draw.textlength(content, font=selected) / 2
    draw.text((x, y), content, font=selected, fill=color)


def background() -> Image.Image:
    rows = np.linspace(np.asarray(BG), np.asarray(BG_LIGHT), H, dtype=np.uint8)
    pixels = np.repeat(rows[:, np.newaxis, :], W, axis=1)
    return Image.fromarray(pixels, "RGB")


def title_card(name: str, headline: str, subtitle: str, *, closing: bool = False) -> Path:
    image = background()
    decoration = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_decoration = ImageDraw.Draw(decoration)
    draw_decoration.ellipse((-140, 720, 290, 1150), fill=(*PINK, 52))
    draw_decoration.ellipse((1640, -180, 2110, 290), fill=(*YELLOW, 45))
    draw_decoration.ellipse((1510, 760, 1850, 1100), fill=(*SKY, 45))
    image = Image.alpha_composite(image.convert("RGBA"), decoration).convert("RGB")
    draw = ImageDraw.Draw(image)
    write_text(draw, (W / 2, 170), "PAIPAI  ·  MOUSE TRAINING", 27, YELLOW, center=True)
    write_text(draw, (W / 2, 305), headline, 82 if not closing else 72, center=True)
    write_text(draw, (W / 2, 438), subtitle, 36, MUTED, center=True, light=True)
    draw.line((850, 550, 1070, 550), fill=YELLOW, width=4)
    if closing:
        write_text(draw, (W / 2, 635), "单击  →  连点  →  拖放  →  路径  →  精准控制", 38, center=True)
        write_text(draw, (W / 2, 720), "游戏记录保存在本机  ·  可离线使用", 28, MUTED, center=True, light=True)
    else:
        write_text(draw, (W / 2, 640), "单击定位  /  连续点击  /  拖动控制  /  精准放置", 35, center=True)
        write_text(draw, (W / 2, 720), "六个游戏，一条循序渐进的鼠标能力路线", 28, MUTED, center=True, light=True)
    write_text(draw, (W / 2, 992), "派派的快乐小鸡乐园  ·  家庭离线小游戏", 21, MUTED, center=True, light=True)
    destination = BUILD / f"{name}.png"
    image.save(destination)
    return destination


def chapter_plate(name: str, number: int) -> Path:
    image = background()
    draw = ImageDraw.Draw(image)
    headline, caption, skill = CHAPTERS[name]
    write_text(draw, (72, 25), "PAIPAI MOUSE TRAINING", 22, YELLOW)
    write_text(draw, (1760, 25), f"{number:02d} / 07", 20, MUTED)
    write_text(draw, (72, 68), headline, 54)
    write_text(draw, (74, 143), caption, 27, MUTED, light=True)
    draw.rounded_rectangle((235, 205, 1685, 1025), radius=18, fill=(11, 29, 51), outline=(255, 255, 255), width=4)
    write_text(draw, (72, 1038), f"训练目标 · {skill}", 18, YELLOW)
    write_text(draw, (1445, 1038), "真实游戏操作  ·  当前版本 1.5.1", 18, MUTED, light=True)
    destination = BUILD / f"{name}-plate.png"
    image.save(destination)
    return destination


def encode_card(name: str, source: Path, duration: float) -> Path:
    destination = BUILD / f"{name}.mp4"
    run([
        "-loop", "1", "-i", source,
        "-t", duration,
        "-vf",
        (
            "zoompan=z='1+0.000035*on':x='iw/2-iw/zoom/2':"
            f"y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30,"
            f"fade=t=in:st=0:d=0.45,fade=t=out:st={duration - .45}:d=0.45,format=yuv420p"
        ),
        "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-threads", "4",
        destination,
    ])
    return destination


def soundtrack(duration: float) -> Path:
    """Create a quiet, original C-major score from elementary waveforms."""
    sample_rate = 48000
    sample_count = int(duration * sample_rate)
    music = np.zeros((sample_count, 2), dtype=np.float32)
    bpm = 100
    beat = 60 / bpm
    chords = [
        (48, 55, 60, 64),
        (43, 50, 55, 59),
        (45, 52, 57, 60),
        (41, 48, 53, 57),
    ]

    def add(start: float, length: float, midi: int, gain: float, pan: float, pluck: bool = False) -> None:
        first = int(start * sample_rate)
        count = min(int(length * sample_rate), sample_count - first)
        if count <= 0:
            return
        time = np.arange(count, dtype=np.float32) / sample_rate
        frequency = 440 * 2 ** ((midi - 69) / 12)
        signal = np.sin(2 * np.pi * frequency * time)
        signal += 0.13 * np.sin(4 * np.pi * frequency * time)
        attack = .018 if pluck else .55
        release = .28 if pluck else .85
        envelope = np.minimum(time / attack, 1)
        envelope *= np.minimum((length - time) / release, 1).clip(0)
        if pluck:
            envelope *= np.exp(-time * 2.8)
        signal *= envelope * gain
        music[first:first + count, 0] += signal * math.sqrt((1 - pan) / 2)
        music[first:first + count, 1] += signal * math.sqrt((1 + pan) / 2)

    melody_pattern = [0, 2, 3, 2, 1, 2, 3, 1]
    for bar in range(math.ceil(duration / (8 * beat))):
        chord = chords[bar % len(chords)]
        start = bar * 8 * beat
        for index, note in enumerate(chord):
            add(start, 8 * beat + .3, note, .026, (index - 1.5) * .23)
        for index, offset in enumerate(melody_pattern):
            add(start + index * beat, 1.2, chord[offset] + 12, .032 if index % 2 == 0 else .023, (-.28 if index % 2 else .28), True)
        for index in range(4):
            add(start + index * beat * 2, .38, chord[0] - 12, .025, 0, True)

    fade = np.minimum(np.arange(sample_count) / (sample_rate * 1.6), 1)
    fade *= np.minimum((sample_count - np.arange(sample_count)) / (sample_rate * 2.5), 1)
    music *= fade[:, None]
    music *= .17 / max(float(np.max(np.abs(music))), .001)
    destination = BUILD / "原创轻音乐.wav"
    with wave.open(str(destination), "wb") as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(sample_rate)
        file.writeframes((music * 32767).astype("<i2").tobytes())
    return destination


def main() -> None:
    capture = json.loads((RAW / "scenes.json").read_text(encoding="utf-8"))
    if capture["errors"] or capture["externalRequests"]:
        raise RuntimeError("录制日志中仍有浏览器错误或外部请求")

    segments: list[tuple[Path, float]] = []
    timeline: list[dict[str, object]] = []
    total = 0.0

    opening = title_card("opening", "派派的快乐小鸡乐园", "把“会点”，一步步练成“会控制”。")
    Image.open(opening).save(ROOT / "宣传片封面.png")
    opening_duration = 5.0
    segments.append((encode_card("opening", opening, opening_duration), opening_duration))
    timeline.append({
        "start": total,
        "duration": opening_duration,
        "title": "派派的快乐小鸡乐园",
        "caption": "把“会点”，一步步练成“会控制”。",
    })
    total += opening_duration

    for number, scene in enumerate(capture["scenes"], 1):
        name = scene["id"]
        duration = round(float(scene["duration"]) * 30) / 30
        destination = BUILD / f"{name}.mp4"
        plate = chapter_plate(name, number)
        run([
            "-ss", scene["start"], "-i", RAW / "operations.webm",
            "-loop", "1", "-framerate", "30", "-i", plate,
            "-filter_complex",
            (
                "[0:v]setpts=PTS-STARTPTS,fps=30,scale=1440:810:flags=lanczos[screen];"
                f"[1:v][screen]overlay=240:210:shortest=1,"
                f"fade=t=in:st=0:d=0.28,fade=t=out:st={duration - .28}:d=0.28,format=yuv420p[v]"
            ),
            "-map", "[v]", "-t", duration, "-an",
            "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-threads", "4",
            destination,
        ])
        segments.append((destination, duration))
        headline, caption, _ = CHAPTERS[name]
        timeline.append({"start": total, "duration": duration, "title": headline, "caption": caption})
        total += duration
        print(f"EDITED {name}", flush=True)

    closing_duration = 6.0
    closing = title_card("closing", "玩一会儿，练一个小动作。", "六个游戏，一条清楚的鼠标能力路线。", closing=True)
    segments.append((encode_card("closing", closing, closing_duration), closing_duration))
    timeline.append({
        "start": total,
        "duration": closing_duration,
        "title": "单击 → 连点 → 拖放 → 路径 → 精准控制",
        "caption": "派派的快乐小鸡乐园 · 家庭离线小游戏",
    })
    total += closing_duration

    concat = BUILD / "segments.txt"
    concat.write_text("\n".join(f"file '{path}'" for path, _ in segments), encoding="utf-8")
    score = soundtrack(total)
    final = ROOT / "派派的快乐小鸡乐园-鼠标训练宣传片-1080p.mp4"
    run([
        "-f", "concat", "-safe", "0", "-i", concat,
        "-i", score,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
        "-movflags", "+faststart",
        "-metadata", "title=Paipai Happy Chicken Playground | Mouse Training Film",
        "-metadata", "comment=Local game demonstration. Original synthesized score. No external assets.",
        final,
    ])

    (ROOT / "source" / "timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({
        "video": str(final),
        "duration": total,
        "size": final.stat().st_size,
        "chapters": len(timeline),
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
