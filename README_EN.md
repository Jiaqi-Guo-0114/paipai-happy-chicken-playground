# Paipai's Happy Chicken Playground

[中文说明](README.md)

A small, offline game collection for children learning to control a mouse. Six activities introduce pointing, repeated clicking, dragging, path following, careful placement and free creation. The app uses plain HTML, CSS and JavaScript, with no online runtime dependency.

Open `打开游戏.command` on macOS or `打开游戏.bat` on Windows. For iPad installation, see [iPad_INSTALL_EN.md](iPad_INSTALL_EN.md). In the game's settings, switch between 中文 and English. Your choice is saved on the current device. The existing optional voice prompts are in Chinese and are labelled “Chinese voice prompts” in the English interface.

## Activities

| Step | Activity | Mouse action |
| --- | --- | --- |
| 1 | Happy Chicken | Point and click to choose where the hen lays an egg |
| 2 | Muddy Puddles | Choose a target and click repeatedly |
| 3 | Chicken Coops | Pick up, drag and release eggs or chicks in the matching coop |
| 4 | Chick Maze | Hold the button and follow a path without crossing walls |
| 5 | Picture Puzzles | Drag pieces close to their correct positions |
| 6 | Sticker Book | Place and rearrange stickers freely |

These activities are games, not a developmental assessment or a claim of therapeutic or educational effectiveness. Mouse and touch input are both supported. Space also lays an egg; Esc or the top-left button returns to the menu.

Progress is stored locally in `localStorage` and does not sync between devices. The PWA caches all runtime resources for offline play. Sound effects, Chinese voice prompts and separate reset actions are in the settings panel.

## Checks

```sh
node tests/logic.test.js
node tests/static-audit.mjs
python3 -m http.server 4173
node tests/browser-smoke.mjs http://127.0.0.1:4173/index.html
```

The browser check covers mouse and touch input, dragging in four activities, the 50-egg limit, sticker and puzzle stress cases, saved progress and an offline cold start.

## Video and voice

The one-minute [product video](宣传素材/派派的快乐小鸡乐园-鼠标训练宣传片-1080p.mp4) has fixed on-screen text, gentle original music and no subtitle track. The local Mandarin prompts were generated with Qwen3-TTS. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for model details.

## Repository status

This repository is intended to stay **private**. It contains recognizable character names and artwork prepared for family use; permission to redistribute those elements has not been established. Do not make the repository public or apply an open-source license to the whole game. A future public edition would need original characters and a fresh asset review.
