'use strict';

const assert = require('node:assert/strict');
const {
  defaultState,
  normalizeState,
  StateStore,
  generateMaze,
  mazeCanMove,
  solveMaze,
  applyCoopDrop,
  shouldSnap
} = require('../js/core.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function test(name, body) {
  try {
    body();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('默认存档包含五个游戏、5枚初始贴纸和8个画布', () => {
  const state = defaultState();
  assert.equal(state.version, 3);
  assert.equal('music' in state.settings, false);
  assert.equal(state.settings.language, 'zh');
  assert.deepEqual(state.stickers.unlocked, [0, 1, 2, 3, 4]);
  assert.equal(state.stickers.canvases.length, 8);
  assert.deepEqual(Object.keys(state.scores.coop.best), ['yellowFree', 'yellowTimed', 'dualFree', 'dualTimed']);
  assert.deepEqual(Object.keys(state.scores.puddle.best), ['peppaFree', 'peppaTimed', 'georgeFree', 'georgeTimed']);
});

test('损坏与旧版存档会安全迁移', () => {
  const malformed = normalizeState({
    version: 1,
    totalEggs: 123,
    settings: { music: true, sfx: 'bad' },
    stickers: { unlocked: [2, 2, 99, -1], canvases: [[{ stickerId: 99 }]] }
  });
  assert.equal(malformed.scores.egg.totalHatched, 123);
  assert.equal(malformed.version, 3);
  assert.equal('music' in malformed.settings, false);
  assert.equal(malformed.settings.sfx, true);
  assert.equal(malformed.settings.language, 'zh');
  assert.equal(normalizeState({ settings: { language: 'en' } }).settings.language, 'en');
  assert.equal(normalizeState({ settings: { language: 'xx' } }).settings.language, 'zh');
  assert.deepEqual(malformed.stickers.unlocked, [0, 1, 2, 3, 4]);
  assert.deepEqual(malformed.stickers.canvases[0], []);

  const storage = new MemoryStorage();
  storage.setItem('paipai-happy-chicken-state', '{broken json');
  const previousWarn = console.warn;
  console.warn = () => {};
  const store = new StateStore(storage);
  console.warn = previousWarn;
  assert.deepEqual(store.state.stickers.unlocked, [0, 1, 2, 3, 4]);
});

test('奖励严格按阈值解锁且不会重复', () => {
  const store = new StateStore(new MemoryStorage());
  assert.equal(store.unlockByProgress('egg', 99, 100).length, 0);
  assert.deepEqual(store.unlockByProgress('egg', 100, 100), [5]);
  assert.equal(store.unlockByProgress('egg', 100, 100).length, 0);
  assert.deepEqual(store.unlockByProgress('egg', 305, 100), [6, 7]);
  assert.equal(store.state.stickers.unlocked.length, 8);
});

test('重置分数与重置贴纸互不误删', () => {
  const store = new StateStore(new MemoryStorage());
  store.state.scores.egg.totalHatched = 220;
  store.state.stickers.unlocked.push(5, 6);
  store.state.stickers.canvases[0].push({ id: 'one', stickerId: 5, x: 50, y: 50, scale: 1, rotation: 0, z: 0 });
  store.resetScores();
  assert.equal(store.state.scores.egg.totalHatched, 0);
  assert.ok(store.state.stickers.unlocked.includes(5));
  store.state.scores.egg.totalHatched = 200;
  store.resetStickers();
  assert.deepEqual(store.state.stickers.unlocked, [0, 1, 2, 3, 4]);
  assert.equal(store.state.stickers.canvases[0].length, 0);
  assert.equal(store.state.rewards.egg, 2);
});

test('六个递进迷宫均有合法完整路径', () => {
  const dimensions = [[5, 4], [6, 4], [7, 5], [8, 5], [9, 6], [10, 6]];
  dimensions.forEach(([cols, rows], level) => {
    const maze = generateMaze(cols, rows, 193 + level * 937);
    const path = solveMaze(maze);
    assert.deepEqual(path[0], maze.start);
    assert.deepEqual(path[path.length - 1], maze.end);
    for (let index = 1; index < path.length; index += 1) assert.equal(mazeCanMove(maze, path[index - 1], path[index]), true);
  });
});

test('双色误投清零并释放，单色误投不清零', () => {
  assert.deepEqual(applyCoopDrop(7, true, false), { score: 0, release: true });
  assert.deepEqual(applyCoopDrop(7, false, false), { score: 7, release: false });
  assert.deepEqual(applyCoopDrop(7, true, true), { score: 8, release: false });
});

test('拼图只在吸附阈值内自动归位', () => {
  assert.equal(shouldSnap({ x: 100, y: 100, homeX: 125, homeY: 115 }, 38), true);
  assert.equal(shouldSnap({ x: 100, y: 100, homeX: 150, homeY: 150 }, 38), false);
});

console.log('逻辑测试全部通过。');
