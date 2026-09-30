import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..');
const screenshots = path.join(root, 'screenshots');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const debugPort = 9300 + process.pid % 500;
const baseUrl = process.argv[2] || 'http://127.0.0.1:4173/index.html';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'paipai-browser-smoke-'));
fs.mkdirSync(screenshots, { recursive: true });

const chromeArgs = [
  '--headless=new',
  '--disable-gpu',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-default-apps',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  '--window-size=1366,768',
  '--hide-scrollbars',
  baseUrl
];
if (baseUrl.startsWith('https:')) chromeArgs.splice(chromeArgs.length - 1, 0, '--ignore-certificate-errors');
const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' });

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function jsonEndpoint() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const list = await pages.json();
      const page = list.find(item => item.type === 'page' && item.url.includes('127.0.0.1')) || list.find(item => item.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(100);
  }
  throw new Error('无法连接 Chrome 调试端口');
}

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Set();
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
      } else this.listeners.forEach(listener => listener(message));
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function main() {
  const client = new CDP(await jsonEndpoint());
  await client.open();
  const errors = [];
  const badResponses = [];
  const expectedOfflineErrors = [];
  let intentionalOffline = false;
  client.listeners.add(message => {
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text || 'Runtime exception');
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry;
      const detail = `${entry.text}${entry.url ? ` · ${entry.url}` : ''}`;
      const manifestIconOffline = intentionalOffline
        && entry.text.includes('ERR_INTERNET_DISCONNECTED')
        && /\/assets\/icons\/icon-(180|192|512)\.png$/.test(entry.url || '');
      if (manifestIconOffline) expectedOfflineErrors.push(detail);
      else errors.push(detail);
    }
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      badResponses.push(`${message.params.response.status} ${message.params.response.url}`);
    }
  });
  await Promise.all([
    client.send('Page.enable'),
    client.send('Runtime.enable'),
    client.send('Network.enable'),
    client.send('Log.enable')
  ]);
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false, screenOrientation: { type: 'landscapePrimary', angle: 0 } });

  async function evaluate(expression) {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || '页面表达式失败');
    return result.result.value;
  }

  async function dragCanvas(points, touch = false) {
    const rect = await evaluate(`(() => { const rect = document.getElementById('gameCanvas').getBoundingClientRect(); return {left:rect.left,top:rect.top,width:rect.width,height:rect.height}; })()`);
    const mapped = points.map(point => ({
      x: rect.left + point.x / 1280 * rect.width,
      y: rect.top + point.y / 720 * rect.height
    }));
    if (touch) {
      const asTouch = point => ({ ...point, id: 73, radiusX: 8, radiusY: 8, force: 1 });
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [asTouch(mapped[0])] });
      for (const point of mapped.slice(1)) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [asTouch(point)] });
        await sleep(18);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...mapped[0] });
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...mapped[0], button: 'left', buttons: 1, clickCount: 1 });
      for (const point of mapped.slice(1)) {
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1 });
        await sleep(18);
      }
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...mapped[mapped.length - 1], button: 'left', buttons: 0, clickCount: 1 });
    }
    await sleep(50);
  }

  async function capture(name) {
    const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshots, `${name}.png`), Buffer.from(result.data, 'base64'));
  }

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate('Boolean(window.__PAIPAI__)')) { ready = true; break; }
    await sleep(100);
  }
  assert.equal(ready, true, await evaluate('`页面未启动：${location.href} · ${document.body.innerText.slice(0,200)}`'));
  assert.equal(await evaluate('window.__PAIPAI__.currentRoute'), 'start');
  await capture('01-start');

  const startPoint = await evaluate(`(() => {
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    const box = window.__PAIPAI__.runtime.scene.startBox;
    return { x: rect.left + (box.x + box.w / 2) / 1280 * rect.width, y: rect.top + (box.y + box.h / 2) / 720 * rect.height };
  })()`);
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startPoint.x, y: startPoint.y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: startPoint.x, y: startPoint.y, button: 'left', clickCount: 1 });
  await sleep(700);
  assert.equal(await evaluate('window.__PAIPAI__.currentRoute'), 'menu');
  await capture('02-menu');
  await evaluate(`(() => { const app = window.__PAIPAI__; app.openSettings(); document.getElementById('languageToggle').click(); })()`);
  assert.equal(await evaluate('document.documentElement.lang'), 'en');
  assert.equal(await evaluate('document.title'), "Paipai's Happy Chicken Playground");
  assert.equal(await evaluate('window.__PAIPAI__.store.state.settings.language'), 'en');
  await capture('02b-menu-english-settings');
  await evaluate(`window.__PAIPAI__.closeModals()`);
  await capture('02c-menu-english');
  await evaluate(`window.__PAIPAI__.navigate('start')`);
  await capture('02d-start-english');
  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('menu'); app.openSettings(); document.getElementById('languageToggle').click(); app.closeModals(); })()`);
  assert.equal(await evaluate('document.documentElement.lang'), 'zh-CN');

  const eggCardPoint = await evaluate(`(() => {
    const canvas = document.getElementById('gameCanvas'); const rect = canvas.getBoundingClientRect();
    const box = window.__PAIPAI__.runtime.scene.cards[0].box;
    return { x: rect.left + (box.x + box.w / 2) / 1280 * rect.width, y: rect.top + (box.y + box.h / 2) / 720 * rect.height };
  })()`);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eggCardPoint.x, y: eggCardPoint.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
  assert.equal(await evaluate('window.__PAIPAI__.currentRoute'), 'egg');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space' });
  await evaluate(`(() => { const scene = window.__PAIPAI__.runtime.scene; scene.layAt(430, 480); scene.layAt(660, 540); scene.layAt(900, 450); })()`);
  await sleep(1100);
  assert.ok(await evaluate('window.__PAIPAI__.runtime.scene.batch + window.__PAIPAI__.runtime.scene.queue.length >= 4'));
  await capture('03-egg');
  await evaluate(`(() => { const scene = window.__PAIPAI__.runtime.scene; scene.queue = []; scene.hatching = true; scene.hatchClock = .54; document.getElementById('caption').classList.add('hidden'); })()`);
  await sleep(120);
  await capture('03b-egg-hatching');
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await sleep(120);
  assert.equal(await evaluate('window.__PAIPAI__.currentRoute'), 'menu');

  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('maze'); const scene = app.runtime.scene; scene.startLevel(2); scene.route = scene.solution.map(cell => ({...cell})); scene.ready = true; scene.startRun(); })()`);
  await sleep(700);
  await capture('04-maze');

  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('coop'); const scene = app.runtime.scene; scene.startMode(scene.modes[3]); scene.countdown = 0; for (let i = 0; i < 5; i += 1) scene.spawn(); scene.items.forEach((item, index) => { item.age = index % 2 ? 2 : .5; item.state = index % 2 ? 'chick' : 'egg'; }); })()`);
  await sleep(350);
  await capture('05-coop');

  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('puddle'); const scene = app.runtime.scene; scene.startMode(scene.modes[1]); scene.countdown = 0; scene.selected = scene.puddles[1]; scene.jump(); })()`);
  await sleep(220);
  await capture('06-puddle');

  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('puzzle'); const scene = app.runtime.scene; scene.sceneId = 2; scene.startPuzzle(9); })()`);
  await sleep(350);
  await capture('07-puzzle');

  await evaluate(`(() => { const app = window.__PAIPAI__; app.navigate('stickers'); const canvas = app.store.state.stickers.canvases[0]; canvas.push({id:'smoke-a',stickerId:0,x:410,y:300,scale:1.2,rotation:-.1,z:0},{id:'smoke-b',stickerId:2,x:650,y:320,scale:1,rotation:.1,z:1},{id:'smoke-c',stickerId:4,x:860,y:255,scale:1.1,rotation:0,z:2}); app.store.save(); })()`);
  await sleep(250);
  await capture('08-stickers');

  await evaluate(`window.__PAIPAI__.navigate('menu'); window.__PAIPAI__.openSettings();`);
  await sleep(200);
  await capture('09-settings');
  await evaluate('window.__PAIPAI__.closeModals()');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
  await sleep(250);
  await capture('10-portrait-rotate');
  await client.send('Emulation.clearDeviceMetricsOverride');

  await client.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
  await sleep(180);
  await capture('11-ipad-landscape');
  await client.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenOrientation: { type: 'landscapePrimary', angle: 0 } });
  await sleep(180);
  await capture('12-desktop-1920x1080');
  await client.send('Emulation.clearDeviceMetricsOverride');

  await sleep(2300);
  const pwaState = await evaluate(`({ text: document.getElementById('offlineStatusText').textContent, ready: document.getElementById('offlineStatus').classList.contains('ready') })`);
  assert.equal(pwaState.ready, true, `PWA 未准备好：${pwaState.text}`);
  let manifestCheck = { skipped: true };
  if (!baseUrl.startsWith('file:')) {
    const manifest = await client.send('Page.getAppManifest');
    assert.ok(manifest.url.endsWith('/app.webmanifest'), `没有发现 Web App Manifest：${manifest.url}`);
    assert.equal((manifest.errors || []).length, 0, `Manifest 有错误：${JSON.stringify(manifest.errors)}`);
    manifestCheck = { url: manifest.url, errors: manifest.errors || [] };
  }

  const mazeGesture = await evaluate(`(() => { const app=window.__PAIPAI__; app.navigate('maze'); const scene=app.runtime.scene; scene.startLevel(1); return scene.solution.map(cell => scene.center(cell)); })()`);
  await dragCanvas(mazeGesture, true);
  const mazePointerRoute = await evaluate('window.__PAIPAI__.runtime.scene.ready');

  const coopGesture = await evaluate(`(() => { const app=window.__PAIPAI__; app.navigate('coop'); const scene=app.runtime.scene; scene.startMode(scene.modes[2]); scene.countdown=0; scene.items=[{id:'gesture-coop',x:500,y:300,age:0,state:'egg',color:'yellow',vx:0,wobble:0,dragging:false}]; return [{x:500,y:300},{x:300,y:360},{x:180,y:500}]; })()`);
  await dragCanvas(coopGesture, true);
  const coopPointerDrop = await evaluate('window.__PAIPAI__.runtime.scene.score === 1 && window.__PAIPAI__.runtime.scene.items.length === 0');

  const puzzleGesture = await evaluate(`(() => { const app=window.__PAIPAI__; app.navigate('puzzle'); const scene=app.runtime.scene; scene.sceneId=0; scene.startPuzzle(4); const piece=scene.pieces.find(item => item.row===0 && item.col===0); scene.pieces=[piece]; return [{x:piece.x+piece.w/2,y:piece.y+piece.h/2},{x:piece.homeX+piece.w/2,y:piece.homeY+piece.h/2}]; })()`);
  await dragCanvas(puzzleGesture, true);
  const puzzlePointerSnap = await evaluate('window.__PAIPAI__.runtime.scene.pieces[0].placed && window.__PAIPAI__.runtime.scene.completed');

  const stickerGesture = await evaluate(`(() => { const app=window.__PAIPAI__; app.store.resetStickers(); app.navigate('stickers'); const entry=app.runtime.scene.trayEntries()[0]; return [{x:entry.x,y:entry.y},{x:600,y:300}]; })()`);
  await dragCanvas(stickerGesture, true);
  const stickerPointerPlace = await evaluate('window.__PAIPAI__.runtime.scene.instances.length === 1');
  await dragCanvas([{x:600,y:300},{x:600,y:650}], true);
  const stickerPointerDelete = await evaluate('window.__PAIPAI__.runtime.scene.instances.length === 0');
  const gestureChecks = { mazePointerRoute, coopPointerDrop, puzzlePointerSnap, stickerPointerPlace, stickerPointerDelete };
  assert.deepEqual(gestureChecks, { mazePointerRoute: true, coopPointerDrop: true, puzzlePointerSnap: true, stickerPointerPlace: true, stickerPointerDelete: true });

  const behaviors = await evaluate(`(() => {
    const app = window.__PAIPAI__;
    app.navigate('coop'); let scene = app.runtime.scene; scene.startMode(scene.modes[3]); scene.countdown = 0;
    scene.score = 5; scene.collected = 5;
    const wrong = {id:'wrong',x:500,y:300,age:2,state:'chick',color:'red',vx:0,wobble:0,dragging:false};
    scene.items = [wrong]; scene.drop(wrong, {x:100,y:420});
    const dualWrongReset = scene.score === 0 && scene.released.length === 5;
    scene.timeLeft = .01; scene.update(.02); const coopTimedFinished = scene.finished;

    app.navigate('puddle'); scene = app.runtime.scene; scene.startMode(scene.modes[1]); scene.countdown = 0; scene.timeLeft = .01; scene.update(.02);
    const puddleTimedFinished = scene.finished;

    app.navigate('maze'); scene = app.runtime.scene; scene.startLevel(5); scene.route = scene.solution.map(cell => ({...cell})); scene.ready = true; scene.startRun();
    scene.chicks.forEach(chick => { chick.progress = scene.route.length; chick.finished = true; }); scene.update(.01);
    const mazeFiveChicks = scene.completed && scene.chickCount === 5;

    app.navigate('puzzle'); scene = app.runtime.scene; scene.sceneId = 0; scene.startPuzzle(4); scene.pieces.forEach(piece => { piece.placed = true; piece.x = piece.homeX; piece.y = piece.homeY; }); scene.finishPuzzle();
    const puzzleCompletionSaved = scene.completed && app.store.state.scores.puzzle.completed['0-4'] >= 1;

    app.navigate('maze'); scene = app.runtime.scene; scene.startLevel(1);
    let point = scene.center(scene.solution[0]);
    scene.handleInput({type:'pointerdown', pointerId:101, ...point});
    point = scene.center(scene.solution[2]);
    scene.handleInput({type:'pointermove', pointerId:101, ...point});
    const mazeFastDragFillsCells = scene.route.length === 3 && scene.route.every((cell, index) => cell.c === scene.solution[index].c && cell.r === scene.solution[index].r);
    scene.handleInput({type:'pointercancel', pointerId:101, ...point});
    scene.startLevel(0);
    point = scene.center(scene.solution[0]);
    scene.handleInput({type:'pointerdown', pointerId:102, ...point});
    const neighbor = scene.center(scene.solution[1]);
    scene.handleInput({type:'pointermove', pointerId:999, ...neighbor});
    scene.handleInput({type:'pointerup', pointerId:999, ...neighbor});
    const mazePointerIsolation = scene.drawing && scene.route.length === 1;
    scene.handleInput({type:'pointercancel', pointerId:102, ...point});

    app.navigate('coop'); scene = app.runtime.scene; scene.startMode(scene.modes[2]); scene.countdown = 0;
    const coopItem = {id:'pointer-coop',x:500,y:300,age:0,state:'egg',color:'yellow',vx:0,wobble:0,dragging:false};
    scene.items = [coopItem];
    scene.handleInput({type:'pointerdown', pointerId:201, x:500, y:300});
    scene.handleInput({type:'pointermove', pointerId:999, x:100, y:420});
    scene.handleInput({type:'pointerup', pointerId:999, x:100, y:420});
    const coopPointerIsolation = scene.dragging === coopItem && scene.score === 0 && scene.items.includes(coopItem);
    scene.handleInput({type:'pointercancel', pointerId:201, x:100, y:420});
    const coopCancelRestores = scene.dragging === null && coopItem.x === 500 && coopItem.y === 300 && scene.items.includes(coopItem);

    app.navigate('puzzle'); scene = app.runtime.scene; scene.sceneId = 0; scene.startPuzzle(4);
    const puzzlePiece = scene.pieces.find(piece => piece.row === 0 && piece.col === 0);
    scene.pieces = [puzzlePiece];
    const puzzlePreciseHit = !scene.hitPiece({x:puzzlePiece.x - 20, y:puzzlePiece.y - 20});
    const puzzleStart = {x:puzzlePiece.x, y:puzzlePiece.y};
    scene.handleInput({type:'pointerdown', pointerId:301, x:puzzlePiece.x + puzzlePiece.w / 2, y:puzzlePiece.y + puzzlePiece.h / 2});
    scene.handleInput({type:'pointermove', pointerId:999, x:puzzlePiece.homeX + puzzlePiece.w / 2, y:puzzlePiece.homeY + puzzlePiece.h / 2});
    scene.handleInput({type:'pointerup', pointerId:999, x:puzzlePiece.homeX + puzzlePiece.w / 2, y:puzzlePiece.homeY + puzzlePiece.h / 2});
    const puzzlePointerIsolation = scene.dragging === puzzlePiece && !puzzlePiece.placed;
    scene.handleInput({type:'pointercancel', pointerId:301, x:puzzlePiece.homeX, y:puzzlePiece.homeY});
    const puzzleCancelRestores = scene.dragging === null && puzzlePiece.x === puzzleStart.x && puzzlePiece.y === puzzleStart.y && !puzzlePiece.placed;

    app.store.resetStickers(); app.navigate('stickers'); scene = app.runtime.scene;
    scene.page = 5;
    const stickerPageRecovered = scene.trayEntries().length === 5 && scene.page === 0;
    scene.page = 0;
    const traySticker = scene.trayEntries()[0];
    scene.handleInput({type:'pointerdown', pointerId:401, x:traySticker.x, y:traySticker.y});
    scene.handleInput({type:'pointermove', pointerId:999, x:600, y:300});
    scene.handleInput({type:'pointerup', pointerId:999, x:600, y:300});
    const stickerPointerIsolation = Boolean(scene.dragging) && scene.instances.length === 0;
    scene.handleInput({type:'pointercancel', pointerId:401, x:600, y:300});
    const stickerCancelDiscards = scene.dragging === null && scene.instances.length === 0;

    return {
      dualWrongReset, coopTimedFinished, puddleTimedFinished, mazeFiveChicks, puzzleCompletionSaved,
      mazeFastDragFillsCells, mazePointerIsolation, coopPointerIsolation, coopCancelRestores,
      puzzlePreciseHit, puzzlePointerIsolation, puzzleCancelRestores,
      stickerPageRecovered, stickerPointerIsolation, stickerCancelDiscards
    };
  })()`);
  assert.deepEqual(behaviors, {
    dualWrongReset: true,
    coopTimedFinished: true,
    puddleTimedFinished: true,
    mazeFiveChicks: true,
    puzzleCompletionSaved: true,
    mazeFastDragFillsCells: true,
    mazePointerIsolation: true,
    coopPointerIsolation: true,
    coopCancelRestores: true,
    puzzlePreciseHit: true,
    puzzlePointerIsolation: true,
    puzzleCancelRestores: true,
    stickerPageRecovered: true,
    stickerPointerIsolation: true,
    stickerCancelDiscards: true
  });

  const stress = await evaluate(`(() => {
    const app = window.__PAIPAI__;
    app.navigate('egg'); const egg = app.runtime.scene;
    for (let index = 0; index < 55; index += 1) egg.layAt(220 + index * 17, 430 + index % 4 * 35);
    const eggLimit = egg.batch + egg.queue.length;
    const routes = ['maze','coop','puddle','puzzle','stickers','menu'];
    for (let index = 0; index < 24; index += 1) app.navigate(routes[index % routes.length]);
    app.navigate('stickers');
    app.store.state.stickers.unlocked = Array.from({length:45}, (_, index) => index);
    app.store.state.stickers.canvases[0] = Array.from({length:45}, (_, index) => ({id:'stress-'+index,stickerId:index,x:100+(index%10)*105,y:130+Math.floor(index/10)*92,scale:.72,rotation:0,z:index}));
    app.store.save();
    app.navigate('puzzle'); app.runtime.scene.sceneId = 3; app.runtime.scene.startPuzzle(16);
    return { eggLimit, pieces: app.runtime.scene.pieces.length, stickers: app.store.state.stickers.canvases[0].length };
  })()`);
  assert.deepEqual(stress, { eggLimit: 50, pieces: 16, stickers: 45 });

  intentionalOffline = true;
  await client.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await client.send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await evaluate('Boolean(window.__PAIPAI__)')) break;
    await sleep(100);
  }
  const offlineColdStart = await evaluate(`({ route: window.__PAIPAI__.currentRoute, stickers: window.__PAIPAI__.store.state.stickers.canvases[0].length, title: document.title })`);
  assert.equal(offlineColdStart.route, 'start');
  assert.equal(offlineColdStart.stickers, 45);
  assert.equal(offlineColdStart.title, '派派的快乐小鸡乐园');
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  intentionalOffline = false;
  assert.deepEqual(badResponses, [], `存在404或其他HTTP错误：${badResponses.join(', ')}`);
  assert.deepEqual(errors, [], `浏览器控制台错误：${errors.join(' | ')}`);

  const report = {
    routes: ['start', 'menu', 'egg', 'egg-hatching', 'maze', 'coop', 'puddle', 'puzzle', 'stickers', 'settings', 'portrait', 'ipad-landscape', 'desktop-1920x1080'],
    pwa: pwaState,
    manifest: manifestCheck,
    gestureChecks,
    behaviors,
    stress,
    offlineColdStart,
    expectedOfflineErrors,
    httpErrors: badResponses,
    consoleErrors: errors
  };
  fs.writeFileSync(path.join(root, 'tests/browser-smoke-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('✓ 13个浏览器场景与视口截图完成');
  console.log('✓ 迷宫、鸡舍、拼图和贴纸真实触屏拖拽链路通过');
  console.log(`✓ ${pwaState.text}`);
  console.log('✓ 控制台无异常，网络无404');
  await client.send('Browser.close');
}

try {
  await main();
} finally {
  if (!chrome.killed) chrome.kill('SIGTERM');
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
}
