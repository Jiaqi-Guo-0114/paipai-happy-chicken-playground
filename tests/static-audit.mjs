import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, '..');

const assetSource = fs.readFileSync(path.join(root, 'assets.js'), 'utf8');
const sandbox = { self: {} };
vm.runInNewContext(assetSource, sandbox, { filename: 'assets.js' });
const assets = sandbox.self.PAIPAI_ASSETS;
assert.ok(Array.isArray(assets) && assets.length > 20, '内容清单没有正确载入');
assert.equal(new Set(assets).size, assets.length, '内容清单含重复路径');

const missing = assets.filter(asset => {
  const local = asset === './' ? root : path.join(root, asset.replace(/^\.\//, ''));
  return !fs.existsSync(local);
});
assert.equal(missing.length, 0, `内容清单缺少文件：${missing.join(', ')}`);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'app.webmanifest'), 'utf8'));
assert.equal(manifest.display, 'fullscreen');
assert.equal(manifest.orientation, 'landscape');
assert.equal(manifest.icons.length, 3);
manifest.icons.forEach(icon => assert.ok(fs.existsSync(path.join(root, icon.src)), `Manifest 图标不存在：${icon.src}`));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(value => !value.startsWith('data:'));
references.forEach(reference => {
  assert.ok(fs.existsSync(path.join(root, reference)), `HTML 引用不存在：${reference}`);
});

const runtimeFiles = ['index.html', 'style.css', 'assets.js', 'script.js', 'sw.js', 'js/core.js', 'js/art.js', 'js/games.js'];
const external = [];
runtimeFiles.forEach(file => {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of content.matchAll(/https?:\/\/[^\s'"<>]+/g)) external.push(`${file}: ${match[0]}`);
});
assert.deepEqual(external, [], `发现运行时外部地址：${external.join(', ')}`);

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.match(serviceWorker, /importScripts\('\.\/assets\.js'\)/);
assert.match(serviceWorker, /cache\.addAll\(APP_SHELL\)/);
assert.match(serviceWorker, /request\.mode === 'navigate'/);

const voiceDirectory = path.join(root, 'assets/audio/voice-qwen');
const voiceFiles = fs.readdirSync(voiceDirectory).filter(name => name.endsWith('.wav'));
assert.equal(voiceFiles.length, 15, '中文语音数量不是15条');
voiceFiles.forEach(name => {
  const buffer = fs.readFileSync(path.join(voiceDirectory, name));
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${name} 不是RIFF WAV`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE', `${name} 不是WAVE音频`);
  assert.equal(buffer.readUInt16LE(22), 1, `${name} 不是单声道`);
  assert.equal(buffer.readUInt32LE(24), 24000, `${name} 不是24 kHz`);
  assert.equal(buffer.readUInt16LE(34), 16, `${name} 不是16-bit PCM`);
});

const coreSource = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8');
assert.doesNotMatch(coreSource, /setInterval\s*\(/, '运行时仍含循环声音定时器');
assert.doesNotMatch(coreSource, /settings\.music|musicTimer|musicStep|startMusic|stopMusic/, '运行时仍含废弃背景音乐代码');
assert.doesNotMatch(html, /musicToggle|背景音乐/, '设置页仍暴露已移除的循环背景音乐');

function pngDimensions(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
for (const size of [180, 192, 512]) {
  assert.deepEqual(pngDimensions(path.join(root, `assets/icons/icon-${size}.png`)), [size, size]);
}

assert.ok(!runtimeFiles.some(file => fs.readFileSync(path.join(root, file), 'utf8').includes('egg-sound.mp3')), '仍然引用旧版缺失音效');
console.log(`✓ ${assets.length}项离线清单全部存在`);
console.log('✓ Manifest、Service Worker、图标、15条24 kHz中文语音均通过静态检查');
console.log('✓ 循环声音定时器和背景音乐开关已经移除');
console.log('✓ 运行时代码没有外部网络地址');
