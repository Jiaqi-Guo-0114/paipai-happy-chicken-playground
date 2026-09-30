(function (root) {
  'use strict';

  const P = root.Paipai = root.Paipai || {};
  const WIDTH = 1280;
  const HEIGHT = 720;
  const STORAGE_KEY = 'paipai-happy-chicken-state';

  P.WIDTH = WIDTH;
  P.HEIGHT = HEIGHT;
  P.STORAGE_KEY = STORAGE_KEY;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const inside = (point, box) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
  const pad3 = value => String(Math.max(0, Math.floor(value))).padStart(3, '0');
  const copy = value => JSON.parse(JSON.stringify(value));

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6D2B79F5;
      let number = value;
      number = Math.imul(number ^ number >>> 15, number | 1);
      number ^= number + Math.imul(number ^ number >>> 7, number | 61);
      return ((number ^ number >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffle(values, random = Math.random) {
    const output = values.slice();
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }

  P.Utils = { clamp, lerp, distance, inside, pad3, copy, seededRandom, shuffle };

  function defaultScores() {
    return {
      egg: { totalHatched: 0, bestBatch: 0 },
      maze: { best: [0, 0, 0, 0, 0, 0], totalChicks: 0 },
      coop: {
        best: { yellowFree: 0, yellowTimed: 0, dualFree: 0, dualTimed: 0 },
        totalCorrect: 0
      },
      puddle: {
        best: { peppaFree: 0, peppaTimed: 0, georgeFree: 0, georgeTimed: 0 },
        totalJumps: 0
      },
      puzzle: { completed: {}, totalCompleted: 0 }
    };
  }

  function defaultState() {
    return {
      version: 3,
      settings: { sfx: true, voice: true, language: 'zh' },
      scores: defaultScores(),
      rewards: { egg: 0, maze: 0, coop: 0, puddle: 0, puzzle: 0 },
      stickers: {
        unlocked: [0, 1, 2, 3, 4],
        canvases: Array.from({ length: 8 }, () => [])
      }
    };
  }

  function finiteNonNegative(value, fallback = 0) {
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function normalizeState(raw) {
    const state = defaultState();
    if (!raw || typeof raw !== 'object') return state;

    if (raw.settings && typeof raw.settings === 'object') {
      ['sfx', 'voice'].forEach(key => {
        if (typeof raw.settings[key] === 'boolean') state.settings[key] = raw.settings[key];
      });
      if (raw.settings.language === 'en') state.settings.language = 'en';
    }

    const sourceScores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
    const egg = sourceScores.egg || {};
    state.scores.egg.totalHatched = finiteNonNegative(egg.totalHatched);
    state.scores.egg.bestBatch = finiteNonNegative(egg.bestBatch);

    const maze = sourceScores.maze || {};
    if (Array.isArray(maze.best)) {
      state.scores.maze.best = state.scores.maze.best.map((_, index) => finiteNonNegative(maze.best[index]));
    }
    state.scores.maze.totalChicks = finiteNonNegative(maze.totalChicks);

    const coop = sourceScores.coop || {};
    const coopBest = coop.best || {};
    Object.keys(state.scores.coop.best).forEach(key => {
      state.scores.coop.best[key] = finiteNonNegative(coopBest[key]);
    });
    state.scores.coop.totalCorrect = finiteNonNegative(coop.totalCorrect);

    const puddle = sourceScores.puddle || {};
    const puddleBest = puddle.best || {};
    Object.keys(state.scores.puddle.best).forEach(key => {
      state.scores.puddle.best[key] = finiteNonNegative(puddleBest[key]);
    });
    state.scores.puddle.totalJumps = finiteNonNegative(puddle.totalJumps);

    const puzzle = sourceScores.puzzle || {};
    state.scores.puzzle.totalCompleted = finiteNonNegative(puzzle.totalCompleted);
    if (puzzle.completed && typeof puzzle.completed === 'object' && !Array.isArray(puzzle.completed)) {
      Object.entries(puzzle.completed).forEach(([key, value]) => {
        state.scores.puzzle.completed[key] = finiteNonNegative(value);
      });
    }

    if (raw.rewards && typeof raw.rewards === 'object') {
      Object.keys(state.rewards).forEach(key => {
        state.rewards[key] = finiteNonNegative(raw.rewards[key]);
      });
    }

    const stickers = raw.stickers || {};
    if (Array.isArray(stickers.unlocked)) {
      state.stickers.unlocked = Array.from(new Set(stickers.unlocked
        .filter(id => Number.isInteger(id) && id >= 0 && id < 45)
        .concat([0, 1, 2, 3, 4])))
        .sort((a, b) => a - b);
    }
    if (Array.isArray(stickers.canvases)) {
      state.stickers.canvases = Array.from({ length: 8 }, (_, background) => {
        const source = Array.isArray(stickers.canvases[background]) ? stickers.canvases[background] : [];
        return source.slice(0, 120).filter(item => item && state.stickers.unlocked.includes(item.stickerId)).map((item, index) => ({
          id: typeof item.id === 'string' ? item.id : `migrated-${background}-${index}`,
          stickerId: item.stickerId,
          x: clamp(finiteNonNegative(item.x, 640), 0, WIDTH),
          y: clamp(finiteNonNegative(item.y, 320), 0, HEIGHT),
          scale: clamp(finiteNonNegative(item.scale, 1), .55, 1.8),
          rotation: Number.isFinite(item.rotation) ? item.rotation : 0,
          z: Number.isFinite(item.z) ? item.z : index
        }));
      });
    }

    // Migrate the tiny counter used by the original page, if it ever existed.
    if (Number.isFinite(raw.totalEggs) && state.scores.egg.totalHatched === 0) {
      state.scores.egg.totalHatched = Math.max(0, raw.totalEggs);
    }
    return state;
  }

  class StateStore {
    constructor(storage) {
      this.storage = storage || null;
      this.state = this.load();
      this.listeners = new Set();
    }

    load() {
      if (!this.storage) return defaultState();
      try {
        const serialized = this.storage.getItem(STORAGE_KEY);
        return serialized ? normalizeState(JSON.parse(serialized)) : defaultState();
      } catch (error) {
        console.warn('存档已损坏，已使用安全默认存档。', error);
        return defaultState();
      }
    }

    save() {
      if (this.storage) {
        try {
          this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (error) {
          console.warn('无法保存游戏进度。', error);
        }
      }
      this.listeners.forEach(listener => listener(this.state));
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    update(mutator) {
      mutator(this.state);
      this.state = normalizeState(this.state);
      this.save();
      return this.state;
    }

    unlockByProgress(kind, total, step) {
      const target = Math.floor(Math.max(0, total) / step);
      const newlyUnlocked = [];
      this.update(state => {
        while (state.rewards[kind] < target) {
          state.rewards[kind] += 1;
          const stickerId = Array.from({ length: 40 }, (_, index) => index + 5)
            .find(id => !state.stickers.unlocked.includes(id));
          if (typeof stickerId === 'number') {
            state.stickers.unlocked.push(stickerId);
            newlyUnlocked.push(stickerId);
          }
        }
      });
      return newlyUnlocked;
    }

    resetScores() {
      this.update(state => {
        state.scores = defaultScores();
        state.rewards = { egg: 0, maze: 0, coop: 0, puddle: 0, puzzle: 0 };
      });
    }

    resetStickers() {
      this.update(state => {
        state.stickers = {
          unlocked: [0, 1, 2, 3, 4],
          canvases: Array.from({ length: 8 }, () => [])
        };
        state.rewards = {
          egg: Math.floor(state.scores.egg.totalHatched / 100),
          maze: Math.floor(state.scores.maze.totalChicks / 20),
          coop: Math.floor(state.scores.coop.totalCorrect / 20),
          puddle: Math.floor(state.scores.puddle.totalJumps / 50),
          puzzle: Math.floor(state.scores.puzzle.totalCompleted)
        };
      });
    }
  }

  P.defaultState = defaultState;
  P.normalizeState = normalizeState;
  P.StateStore = StateStore;

  function generateMaze(cols, rows, seed) {
    const random = seededRandom(seed);
    const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
      walls: [true, true, true, true],
      visited: false
    })));
    const directions = [
      { dc: 0, dr: -1, wall: 0, opposite: 2 },
      { dc: 1, dr: 0, wall: 1, opposite: 3 },
      { dc: 0, dr: 1, wall: 2, opposite: 0 },
      { dc: -1, dr: 0, wall: 3, opposite: 1 }
    ];
    const stack = [{ c: 0, r: 0 }];
    cells[0][0].visited = true;
    while (stack.length) {
      const current = stack[stack.length - 1];
      const candidates = shuffle(directions, random).filter(direction => {
        const c = current.c + direction.dc;
        const r = current.r + direction.dr;
        return c >= 0 && c < cols && r >= 0 && r < rows && !cells[r][c].visited;
      });
      if (!candidates.length) {
        stack.pop();
        continue;
      }
      const direction = candidates[0];
      const next = { c: current.c + direction.dc, r: current.r + direction.dr };
      cells[current.r][current.c].walls[direction.wall] = false;
      cells[next.r][next.c].walls[direction.opposite] = false;
      cells[next.r][next.c].visited = true;
      stack.push(next);
    }
    cells.forEach(row => row.forEach(cell => { delete cell.visited; }));
    return { cols, rows, cells, start: { c: 0, r: 0 }, end: { c: cols - 1, r: rows - 1 } };
  }

  function mazeCanMove(maze, from, to) {
    const dc = to.c - from.c;
    const dr = to.r - from.r;
    if (Math.abs(dc) + Math.abs(dr) !== 1) return false;
    const wall = dr === -1 ? 0 : dc === 1 ? 1 : dr === 1 ? 2 : 3;
    return !maze.cells[from.r][from.c].walls[wall];
  }

  function solveMaze(maze) {
    const queue = [maze.start];
    const key = cell => `${cell.c},${cell.r}`;
    const previous = new Map([[key(maze.start), null]]);
    const steps = [
      { dc: 0, dr: -1 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }
    ];
    while (queue.length) {
      const current = queue.shift();
      if (current.c === maze.end.c && current.r === maze.end.r) break;
      steps.forEach(step => {
        const next = { c: current.c + step.dc, r: current.r + step.dr };
        if (next.c < 0 || next.c >= maze.cols || next.r < 0 || next.r >= maze.rows) return;
        if (!mazeCanMove(maze, current, next) || previous.has(key(next))) return;
        previous.set(key(next), current);
        queue.push(next);
      });
    }
    const path = [];
    let cursor = maze.end;
    while (cursor) {
      path.push(cursor);
      cursor = previous.get(key(cursor));
    }
    return path.reverse();
  }

  function applyCoopDrop(score, dualMode, correct) {
    if (correct) return { score: score + 1, release: false };
    return dualMode ? { score: 0, release: true } : { score, release: false };
  }

  function shouldSnap(piece, threshold = 38) {
    return Math.hypot(piece.x - piece.homeX, piece.y - piece.homeY) <= threshold;
  }

  P.Logic = { generateMaze, mazeCanMove, solveMaze, applyCoopDrop, shouldSnap };

  class AudioManager {
    constructor(settings) {
      this.settings = settings;
      this.context = null;
      this.unlocked = false;
      this.voiceQueue = [];
      this.currentVoice = null;
      this.voiceBase = 'assets/audio/voice-qwen/';
    }

    async unlock() {
      if (this.unlocked) return true;
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (!AudioContextClass) return false;
      try {
        this.context = this.context || new AudioContextClass();
        if (this.context.state === 'suspended') await this.context.resume();
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        gain.gain.value = .00001;
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start();
        oscillator.stop(this.context.currentTime + .02);
        this.unlocked = true;
        return true;
      } catch (error) {
        console.warn('音频初始化失败。', error);
        return false;
      }
    }

    tone(frequency, duration, options = {}) {
      if (!this.unlocked || !this.context || !this.settings.sfx) return;
      const now = this.context.currentTime + (options.delay || 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = options.type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(options.volume || .045, now + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + .03);
    }

    noise(duration = .12, volume = .028) {
      if (!this.unlocked || !this.context || !this.settings.sfx) return;
      const length = Math.floor(this.context.sampleRate * duration);
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain).connect(this.context.destination);
      source.start();
    }

    sfx(name) {
      if (!this.settings.sfx) return;
      const patterns = {
        tap: [[520, .06, 680]],
        lay: [[410, .11, 260], [560, .08, 390]],
        crack: [[220, .08, 180]],
        chirp: [[900, .07, 1300], [1100, .06, 1500]],
        jump: [[230, .11, 480], [160, .08, 120]],
        correct: [[523, .1, 523], [659, .12, 659], [784, .18, 784]],
        wrong: [[220, .16, 150], [175, .2, 110]],
        reward: [[523, .1, 523], [659, .1, 659], [784, .1, 784], [1047, .3, 1047]],
        seed: [[760, .04, 900]],
        snap: [[440, .08, 660]]
      };
      if (name === 'crack' || name === 'jump') this.noise(name === 'jump' ? .14 : .08, .024);
      (patterns[name] || patterns.tap).forEach((entry, index) => {
        this.tone(entry[0], entry[1], { endFrequency: entry[2], delay: index * .075, type: name === 'wrong' ? 'triangle' : 'sine' });
      });
    }

    voice(key, interrupt = false) {
      if (!this.settings.voice || typeof root.Audio !== 'function') return;
      if (interrupt) {
        this.voiceQueue.length = 0;
        if (this.currentVoice) {
          this.currentVoice.pause();
          this.currentVoice = null;
        }
      }
      this.voiceQueue.push(key);
      this.playNextVoice();
    }

    playNextVoice() {
      if (this.currentVoice || !this.voiceQueue.length || !this.settings.voice) return;
      const key = this.voiceQueue.shift();
      const audio = new root.Audio(`${this.voiceBase}${key}.wav`);
      audio.preload = 'auto';
      this.currentVoice = audio;
      const finish = () => {
        this.currentVoice = null;
        this.playNextVoice();
      };
      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      const result = audio.play();
      if (result && typeof result.catch === 'function') result.catch(finish);
    }

    stopVoice() {
      this.voiceQueue.length = 0;
      if (this.currentVoice) this.currentVoice.pause();
      this.currentVoice = null;
    }

    applySettings(settings) {
      this.settings = settings;
      if (!settings.voice) this.stopVoice();
    }
  }

  P.AudioManager = AudioManager;

  class Scene {
    enter(runtime, config = {}) {
      this.runtime = runtime;
      this.app = runtime.app;
      this.config = config;
      this.elapsed = 0;
    }
    update(delta) { this.elapsed += delta; }
    render() {}
    handleInput() {}
    exit() {}
  }

  P.Scene = Scene;

  class Runtime {
    constructor(canvas, app) {
      this.canvas = canvas;
      this.app = app;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      this.scene = null;
      this.sceneName = '';
      this.lastFrame = 0;
      this.running = false;
      this.paused = false;
      this.dpr = 1;
      this.boundFrame = this.frame.bind(this);
      this.boundPointer = this.pointer.bind(this);
      this.boundKey = this.key.bind(this);
      this.boundVisibility = this.visibility.bind(this);
      this.bindEvents();
      this.resize();
    }

    bindEvents() {
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => this.canvas.addEventListener(type, this.boundPointer));
      root.addEventListener('keydown', this.boundKey);
      root.addEventListener('resize', () => this.resize(), { passive: true });
      if (root.document) root.document.addEventListener('visibilitychange', this.boundVisibility);
    }

    resize() {
      const nextDpr = clamp(root.devicePixelRatio || 1, 1, 2);
      if (this.canvas.width !== WIDTH * nextDpr || this.canvas.height !== HEIGHT * nextDpr) {
        this.dpr = nextDpr;
        this.canvas.width = WIDTH * nextDpr;
        this.canvas.height = HEIGHT * nextDpr;
      }
    }

    setScene(name, scene, config = {}) {
      if (this.scene && typeof this.scene.exit === 'function') this.scene.exit();
      this.sceneName = name;
      this.scene = scene;
      this.scene.enter(this, config);
      this.app.sceneChanged(name);
    }

    pointer(original) {
      if (!this.scene || this.app.modalOpen()) return;
      const rect = this.canvas.getBoundingClientRect();
      const event = {
        type: original.type,
        x: (original.clientX - rect.left) * WIDTH / rect.width,
        y: (original.clientY - rect.top) * HEIGHT / rect.height,
        pointerId: original.pointerId,
        original
      };
      if (original.type === 'pointerdown') {
        try { this.canvas.setPointerCapture(original.pointerId); } catch (_) {}
      }
      this.scene.handleInput(event);
      original.preventDefault();
    }

    key(original) {
      if (this.app.modalOpen()) {
        if (original.key === 'Escape') this.app.closeModals();
        return;
      }
      if (original.key === 'Escape') {
        this.app.back();
        original.preventDefault();
        return;
      }
      if (this.scene) this.scene.handleInput({ type: 'keydown', key: original.key, code: original.code, original });
    }

    visibility() {
      this.paused = root.document.hidden;
      this.lastFrame = performance.now();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastFrame = performance.now();
      root.requestAnimationFrame(this.boundFrame);
    }

    frame(timestamp) {
      if (!this.running) return;
      const delta = this.paused ? 0 : clamp((timestamp - this.lastFrame) / 1000, 0, .05);
      this.lastFrame = timestamp;
      if (this.scene && delta > 0) this.scene.update(delta);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
      if (this.scene) this.scene.render(this.ctx);
      root.requestAnimationFrame(this.boundFrame);
    }
  }

  P.Runtime = Runtime;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      defaultState,
      normalizeState,
      StateStore,
      generateMaze,
      mazeCanMove,
      solveMaze,
      applyCoopDrop,
      shouldSnap
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
