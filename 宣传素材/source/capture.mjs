import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(playwrightModule);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = path.join(projectRoot, '宣传素材');
const raw = path.join(outputRoot, 'raw');
const port = Number(process.env.PAIPAI_PROMO_PORT || 4174);
const url = `http://127.0.0.1:${port}/index.html`;

await fs.mkdir(raw, { recursive: true });

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: projectRoot,
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  stdio: ['ignore', 'ignore', 'pipe']
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`本地游戏服务未在端口 ${port} 启动`);
}

let browser;
let context;
const scenes = [];
const errors = [];
const externalRequests = [];

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: raw, size: { width: 1280, height: 720 } }
  });
  await context.addInitScript(() => {
    localStorage.removeItem('paipai-happy-chicken-state');
    document.addEventListener('DOMContentLoaded', () => {
      const pointer = document.createElement('div');
      pointer.id = 'promo-pointer';
      pointer.style.cssText = [
        'position:fixed', 'left:0', 'top:0', 'width:22px', 'height:22px',
        'border:3px solid #fff', 'border-radius:50%', 'background:#ef557c',
        'box-shadow:0 2px 8px #173b5c99', 'pointer-events:none',
        'z-index:2147483647', 'transform:translate(-50%,-50%)', 'opacity:0'
      ].join(';');
      document.body.append(pointer);
      document.addEventListener('mousemove', event => {
        pointer.style.left = `${event.clientX}px`;
        pointer.style.top = `${event.clientY}px`;
        pointer.style.opacity = '1';
      });
      document.addEventListener('mousedown', () => {
        pointer.animate([
          { boxShadow: '0 0 0 0 #ffe04fdd, 0 2px 8px #173b5c99' },
          { boxShadow: '0 0 0 24px #ffe04f00, 0 2px 8px #173b5c99' }
        ], { duration: 520, easing: 'ease-out' });
      });
    });
  });

  const page = await context.newPage();
  const video = page.video();
  const recordingStart = Date.now();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', request => {
    const target = new URL(request.url());
    if (target.hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  page.setDefaultTimeout(12000);
  const hold = milliseconds => page.waitForTimeout(milliseconds);

  async function clickPoint(x, y, pause = 380) {
    await page.mouse.move(x, y, { steps: 20 });
    await hold(120);
    await page.mouse.click(x, y);
    await hold(pause);
  }

  async function drag(points, stepMilliseconds = 85) {
    await page.mouse.move(points[0].x, points[0].y, { steps: 18 });
    await hold(100);
    await page.mouse.down();
    for (const point of points.slice(1)) {
      await page.mouse.move(point.x, point.y, { steps: 8 });
      await hold(stepMilliseconds);
    }
    await page.mouse.up();
    await hold(260);
  }

  async function shot(id, seconds, action) {
    const start = (Date.now() - recordingStart) / 1000;
    await action();
    const elapsed = (Date.now() - recordingStart) / 1000 - start;
    if (elapsed < seconds) await hold((seconds - elapsed) * 1000);
    const duration = (Date.now() - recordingStart) / 1000 - start;
    await page.screenshot({ path: path.join(raw, `${id}.png`) });
    scenes.push({ id, start, duration });
    console.log(`RECORDED ${id} ${duration.toFixed(1)}s`);
  }

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__PAIPAI__));
  await page.addStyleTag({ content: '.caption,.offline-status{display:none!important}' });
  await page.evaluate(() => {
    window.__PAIPAI__.store.update(state => {
      state.settings.sfx = false;
      state.settings.voice = false;
    });
    window.__PAIPAI__.audio.applySettings(window.__PAIPAI__.store.state.settings);
  });

  await shot('home', 6, async () => {
    await hold(1700);
    await clickPoint(640, 642, 700);
    await page.waitForFunction(() => window.__PAIPAI__.currentRoute === 'menu');
    await page.mouse.move(260, 280, { steps: 28 });
  });

  await page.evaluate(() => window.__PAIPAI__.navigate('egg'));
  await hold(350);
  await shot('egg', 8, async () => {
    const targets = [[330, 490], [510, 430], [690, 535], [870, 455], [1050, 520]];
    for (const [x, y] of targets) await clickPoint(x, y, 470);
    await page.evaluate(() => {
      const scene = window.__PAIPAI__.runtime.scene;
      if (scene.batch && !scene.queue.length) scene.lastLay = scene.elapsed - 1.45;
    });
  });

  await page.evaluate(() => window.__PAIPAI__.navigate('puddle'));
  await hold(350);
  await shot('puddle', 7, async () => {
    await hold(500);
    await clickPoint(420, 282, 620);
    await clickPoint(650, 555, 440);
    for (let index = 0; index < 6; index += 1) await clickPoint(650, 555, 400);
  });

  await page.evaluate(() => window.__PAIPAI__.navigate('coop'));
  await hold(350);
  await shot('coop', 7, async () => {
    await hold(450);
    await clickPoint(420, 282, 500);
    await page.evaluate(() => {
      const scene = window.__PAIPAI__.runtime.scene;
      scene.spawnClock = 999;
      scene.items = [
        { id: 'promo-egg', x: 690, y: 285, age: .45, state: 'egg', color: 'yellow', vx: 0, wobble: 0, dragging: false },
        { id: 'promo-chick', x: 540, y: 410, age: 2.2, state: 'chick', color: 'yellow', vx: 0, wobble: 0, dragging: false }
      ];
    });
    await drag([{ x: 690, y: 285 }, { x: 820, y: 350 }, { x: 960, y: 430 }, { x: 1090, y: 510 }], 120);
    await drag([{ x: 540, y: 410 }, { x: 720, y: 430 }, { x: 910, y: 470 }, { x: 1090, y: 520 }], 120);
  });

  await page.evaluate(() => window.__PAIPAI__.navigate('maze'));
  await hold(350);
  await shot('maze', 7, async () => {
    await hold(450);
    await clickPoint(310, 285, 450);
    const route = await page.evaluate(() => {
      const scene = window.__PAIPAI__.runtime.scene;
      return scene.solution.map(cell => scene.center(cell));
    });
    await drag(route, 70);
    await clickPoint(1130, 560, 650);
  });

  await page.evaluate(() => {
    window.__PAIPAI__.navigate('puzzle');
    const scene = window.__PAIPAI__.runtime.scene;
    scene.sceneId = 1;
    scene.startPuzzle(4);
  });
  await hold(350);
  await shot('puzzle', 7, async () => {
    for (let index = 0; index < 3; index += 1) {
      const points = await page.evaluate(() => {
        const scene = window.__PAIPAI__.runtime.scene;
        const piece = scene.pieces.find(candidate => !candidate.placed);
        return [
          { x: piece.x + piece.w / 2, y: piece.y + piece.h / 2 },
          { x: (piece.x + piece.homeX) / 2 + piece.w / 2, y: (piece.y + piece.homeY) / 2 + piece.h / 2 },
          { x: piece.homeX + piece.w / 2, y: piece.homeY + piece.h / 2 }
        ];
      });
      await drag(points, 150);
    }
  });

  await page.evaluate(() => window.__PAIPAI__.navigate('stickers'));
  await hold(350);
  await shot('stickers', 7, async () => {
    await drag([{ x: 145, y: 652 }, { x: 300, y: 470 }, { x: 410, y: 300 }], 120);
    await drag([{ x: 269, y: 652 }, { x: 500, y: 490 }, { x: 650, y: 350 }], 120);
    await drag([{ x: 393, y: 652 }, { x: 690, y: 450 }, { x: 890, y: 270 }], 120);
    await page.mouse.move(1090, 360, { steps: 24 });
  });

  if (errors.length) throw new Error(`浏览器错误：\n${errors.join('\n')}`);
  if (externalRequests.length) throw new Error(`录制出现外部请求：\n${externalRequests.join('\n')}`);

  await context.close();
  context = null;
  await video.saveAs(path.join(raw, 'operations.webm'));
  await fs.writeFile(path.join(raw, 'scenes.json'), JSON.stringify({
    scenes,
    errors,
    externalRequests,
    disclosure: '本地临时演示存档；没有读取家庭真实进度；没有外部网络请求。'
  }, null, 2));
} finally {
  await context?.close();
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
}
