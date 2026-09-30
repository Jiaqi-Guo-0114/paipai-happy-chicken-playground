(function (root) {
  'use strict';

  const P = root.Paipai;
  const Art = P.Art;
  const { clamp, lerp, distance, inside, seededRandom, shuffle } = P.Utils;
  const { generateMaze, mazeCanMove, solveMaze, applyCoopDrop, shouldSnap } = P.Logic;
  const Games = P.Games = {};

  function panel(ctx, x, y, w, h, color = 'rgba(255,248,223,.96)') {
    Art.roundedRect(ctx, x + 7, y + 9, w, h, 32);
    ctx.fillStyle = 'rgba(39,55,72,.22)'; ctx.fill();
    Art.roundedRect(ctx, x, y, w, h, 32);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.stroke();
  }

  function topTitle(ctx, title, subtitle) {
    Art.text(ctx, title, 640, 72, 48, { color: '#fff', stroke: 'rgba(44,61,81,.3)', strokeWidth: 6, shadow: true });
    if (subtitle) Art.text(ctx, subtitle, 640, 117, 20, { color: 'rgba(255,255,255,.95)', weight: 650 });
  }

  function resultOverlay(ctx, title, detail, primaryLabel = '再玩一次', secondaryLabel = '游戏菜单') {
    ctx.fillStyle = 'rgba(24,49,75,.58)'; ctx.fillRect(0, 0, 1280, 720);
    panel(ctx, 340, 165, 600, 390);
    Art.starPath(ctx, 640, 237, 55, 27); ctx.fillStyle = '#ffd94d'; ctx.fill(); ctx.strokeStyle = Art.INK; ctx.lineWidth = 5; ctx.stroke();
    Art.text(ctx, title, 640, 324, 48, { color: '#dc4e72' });
    Art.text(ctx, detail, 640, 378, 27, { color: '#6f5848', weight: 700 });
    const primary = { x: 405, y: 445, w: 215, h: 76 };
    const secondary = { x: 660, y: 445, w: 215, h: 76 };
    Art.drawButton(ctx, primary, primaryLabel, '#63bd67', { shadow: '#358f45', fontSize: 26 });
    Art.drawButton(ctx, secondary, secondaryLabel, '#4c94d8', { shadow: '#2864a4', fontSize: 25 });
    return { primary, secondary };
  }

  class StartScene extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.startBox = { x: 472, y: 600, w: 336, h: 83 };
    }

    handleInput(event) {
      if (event.type === 'pointerdown' && inside(event, this.startBox)) {
        this.app.audio.unlock();
        this.app.audio.sfx('correct');
        this.app.navigate('menu');
        this.app.voice('welcome', '欢迎来到派派的快乐小鸡乐园！');
      }
    }

    update(delta) { super.update(delta); }

    render(ctx) {
      Art.drawStartScene(ctx, this.elapsed);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      Art.roundedRect(ctx, 250, 20, 780, 190, 44); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.stroke();
      Art.text(ctx, 'Peppa Pig', 640, 63, 48, { color: '#ef557c', stroke: '#fff', strokeWidth: 3 });
      Art.text(ctx, '派派的快乐小鸡乐园', 640, 121, 38, { color: '#3689ce', weight: 800 });
      Art.text(ctx, '从单击到拖放，玩着练会鼠标', 640, 169, 23, { color: '#6a7180', weight: 700 });
      Art.drawButton(ctx, this.startBox, '开始训练', '#ef5e7d', { shadow: '#b53c59', fontSize: 36 });
      ctx.restore();
    }
  }

  class MenuScene extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.cards = [
        { key: 'egg', step: 1, title: '快乐小鸡下蛋', sub: '单击定位 · 手眼协调', color: '#f3b43f', box: { x: 95, y: 164, w: 330, h: 230 } },
        { key: 'puddle', step: 2, title: '泥坑跳跃', sub: '目标选择 · 连续点击', color: '#8d6bc5', box: { x: 475, y: 164, w: 330, h: 230 } },
        { key: 'coop', step: 3, title: '鸡舍分类', sub: '抓取拖放 · 颜色分类', color: '#eb7b52', box: { x: 855, y: 164, w: 330, h: 230 } },
        { key: 'maze', step: 4, title: '小鸡迷宫', sub: '按住拖动 · 路径控制', color: '#72bd5f', box: { x: 95, y: 438, w: 330, h: 230 } },
        { key: 'puzzle', step: 5, title: '快乐拼图', sub: '精准拖放 · 空间定位', color: '#4aa8ca', box: { x: 475, y: 438, w: 330, h: 230 } },
        { key: 'stickers', step: 6, title: '我的贴纸册', sub: '自由拖放 · 创意表达', color: '#e85e92', box: { x: 855, y: 438, w: 330, h: 230 } }
      ];
    }

    handleInput(event) {
      if (event.type !== 'pointerdown') return;
      const card = this.cards.find(item => inside(event, item.box));
      if (!card) return;
      this.app.audio.sfx('tap');
      this.app.navigate(card.key);
    }

    render(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '选择一种鼠标练习', '从单击到拖放，六步循序练习');
      const icons = {
        egg: (draw, x, y, s) => { Art.drawHen(draw, x - 25, y + 4, s / 175); Art.drawEgg(draw, x + 62, y + 24, s / 125); },
        maze: (draw, x, y, s) => { Art.drawChick(draw, x - 42, y + 8, s / 125); Art.drawSeed(draw, x + 37, y - 25, s / 40); Art.drawSeed(draw, x + 66, y + 6, s / 40); },
        coop: (draw, x, y, s) => Art.drawCoop(draw, x, y + 14, s / 180, '#ffd13c'),
        puddle: (draw, x, y, s) => { Art.drawPuddle(draw, x, y + 38, s / 150, 1); Art.drawPig(draw, x, y - 12, s / 250, { outfit: '#ef5678', muddy: true }); },
        puzzle: (draw, x, y, s) => { for (let r = 0; r < 2; r += 1) for (let c = 0; c < 2; c += 1) { Art.roundedRect(draw, x - s * .45 + c * s * .47, y - s * .4 + r * s * .47, s * .43, s * .43, 8); draw.fillStyle = ['#ffd24e','#ef6784','#6cc66c','#58a8df'][r * 2 + c]; draw.fill(); draw.strokeStyle = '#fff'; draw.lineWidth = 4; draw.stroke(); } },
        stickers: (draw, x, y, s) => { Art.drawSticker(draw, 4, x - 44, y, s * .65); Art.drawSticker(draw, 2, x + 48, y + 5, s * .65, .15); }
      };
      this.cards.forEach(card => {
        Art.drawCard(ctx, card.box, card.color, card.title, card.sub, icons[card.key]);
        ctx.beginPath(); ctx.arc(card.box.x + 31, card.box.y + 31, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = 'rgba(79,58,50,.2)'; ctx.lineWidth = 3; ctx.stroke();
        Art.text(ctx, String(card.step), card.box.x + 31, card.box.y + 32, 22, { color: card.color, weight: 900 });
      });
    }
  }

  class EggGame extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.hen = { x: 640, y: 255, tx: 640, ty: 255, direction: 1 };
      this.queue = [];
      this.eggs = [];
      this.batch = 0;
      this.hatching = false;
      this.hatchClock = 0;
      this.lastLay = 0;
      this.roundDone = false;
      this.doneTimer = 0;
      this.chirpIndex = -1;
      this.app.voice('egg', '点一下蓝色画面，快乐小鸡就会到那里下蛋。也可以按空格键。');
    }

    layAt(x, y) {
      if (this.hatching || this.roundDone) {
        this.app.toast('先等小鸡们孵出来吧');
        return;
      }
      if (this.batch + this.queue.length >= 50) {
        this.app.toast('这一批已经有50枚蛋啦');
        return;
      }
      const target = { x: clamp(x, 195, 1110), y: clamp(y - 90, 185, 455) };
      this.queue.push(target);
      this.lastLay = this.elapsed;
      this.app.audio.sfx('tap');
    }

    handleInput(event) {
      if (event.type === 'pointerdown') this.layAt(event.x, event.y);
      if (event.type === 'keydown' && (event.code === 'Space' || event.key === ' ')) {
        this.layAt(260 + Math.random() * 780, 340 + Math.random() * 260);
        event.original.preventDefault();
      }
    }

    finishBatch() {
      if (this.roundDone) return;
      this.roundDone = true;
      this.doneTimer = 0;
      const amount = this.batch;
      this.app.store.update(state => {
        state.scores.egg.totalHatched += amount;
        state.scores.egg.bestBatch = Math.max(state.scores.egg.bestBatch, amount);
      });
      const total = this.app.store.state.scores.egg.totalHatched;
      const unlocked = this.app.store.unlockByProgress('egg', total, 100);
      this.app.audio.sfx('correct');
      if (unlocked.length) this.app.award(unlocked);
    }

    resetRound() {
      this.eggs = [];
      this.batch = 0;
      this.hatching = false;
      this.hatchClock = 0;
      this.roundDone = false;
      this.doneTimer = 0;
      this.chirpIndex = -1;
      this.lastLay = this.elapsed;
    }

    update(delta) {
      super.update(delta);
      if (!this.hatching && this.queue.length) {
        const target = this.queue[0];
        this.hen.direction = target.x < this.hen.x ? -1 : 1;
        const dx = target.x - this.hen.x;
        const dy = target.y - this.hen.y;
        const length = Math.hypot(dx, dy);
        const step = Math.min(length, delta * 720);
        if (length > .001) {
          this.hen.x += dx / length * step;
          this.hen.y += dy / length * step;
        }
        if (length < 9) {
          const point = this.queue.shift();
          this.batch += 1;
          this.eggs.push({ x: point.x + (Math.random() - .5) * 18, y: point.y + 100, phase: 0, direction: Math.random() < .5 ? -1 : 1 });
          this.lastLay = this.elapsed;
          this.app.audio.sfx('lay');
        }
      }
      if (!this.hatching && !this.queue.length && this.batch > 0 && this.elapsed - this.lastLay >= 1.5) {
        this.hatching = true;
        this.hatchClock = 0;
        this.app.audio.sfx('crack');
      }
      if (this.hatching) {
        this.hatchClock += delta;
        this.eggs.forEach((egg, index) => {
          egg.phase = Math.max(0, this.hatchClock - index * .085);
          if (egg.phase > .62 && index > this.chirpIndex) {
            this.chirpIndex = index;
            if (index % 4 === 0) this.app.audio.sfx('chirp');
          }
          if (egg.phase > 1.05) {
            egg.x += egg.direction * delta * (145 + index % 4 * 12);
            egg.y += Math.sin((egg.phase + index) * 12) * delta * 13;
          }
        });
        const lastPhase = this.eggs.length ? this.eggs[this.eggs.length - 1].phase : 0;
        if (lastPhase > 3.35 && !this.roundDone) this.finishBatch();
      }
      if (this.roundDone) {
        this.doneTimer += delta;
        if (this.doneTimer > 1.7) this.resetRound();
      }
    }

    render(ctx) {
      ctx.fillStyle = '#31afe7'; ctx.fillRect(0, 0, 1280, 720);
      Art.drawCounter(ctx, this.batch, 124, 31);
      Art.drawHen(ctx, this.hen.x, this.hen.y + Math.sin(this.elapsed * 9) * 3, .78, { direction: this.hen.direction });
      this.eggs.forEach((egg, index) => {
        if (!this.hatching || egg.phase < .62) {
          Art.drawEgg(ctx, egg.x, egg.y, .78, this.hatching ? clamp(egg.phase / .62, 0, .47) : 0);
        } else {
          if (egg.phase < 1.25) Art.drawEgg(ctx, egg.x, egg.y + 18, .78, .8);
          Art.drawChick(ctx, egg.x, egg.y - (egg.phase < 1.05 ? 2 : 13), .56, { direction: egg.direction });
        }
      });
      if (!this.batch && !this.queue.length) Art.text(ctx, '单击定位：点一下你想让快乐小鸡去的位置', 640, 655, 27, { color: 'rgba(255,255,255,.95)', stroke: 'rgba(32,80,111,.35)', strokeWidth: 4 });
      else if (!this.hatching) Art.text(ctx, `这一批 ${this.batch + this.queue.length}/50 · 停下来就会孵化`, 640, 666, 23, { color: '#fff', weight: 700 });
      if (this.roundDone) {
        panel(ctx, 425, 255, 430, 170, 'rgba(255,248,218,.96)');
        Art.text(ctx, `${this.batch}只小鸡孵出来啦！`, 640, 325, 35, { color: '#dc5171' });
        Art.text(ctx, '马上开始下一批', 640, 380, 22, { color: '#6f5a4b', weight: 650 });
      }
    }
  }

  class MazeGame extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.selecting = true;
      this.levelBoxes = Array.from({ length: 6 }, (_, index) => ({
        x: 165 + (index % 3) * 330,
        y: 190 + Math.floor(index / 3) * 230,
        w: 290,
        h: 190,
        level: index
      }));
      this.motionHandler = event => {
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;
        const magnitude = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
        if (magnitude > 28 && performance.now() - (this.lastShake || 0) > 1300) {
          this.lastShake = performance.now();
          this.startRun();
        }
      };
      root.addEventListener('devicemotion', this.motionHandler, { passive: true });
      this.app.voice('maze', '选一条迷宫，从小鸡这里拖动，画一条种子路线到鸡舍。');
    }

    exit() { root.removeEventListener('devicemotion', this.motionHandler); }

    startLevel(level) {
      this.selecting = false;
      this.level = level;
      const dimensions = [[5,4],[6,4],[7,5],[8,5],[9,6],[10,6]][level];
      this.maze = generateMaze(dimensions[0], dimensions[1], 193 + level * 937);
      this.solution = solveMaze(this.maze);
      this.region = { x: 138, y: 156, w: 842, h: 494 };
      this.route = [];
      this.drawing = false;
      this.drawingPointerId = null;
      this.ready = false;
      this.running = false;
      this.completed = false;
      this.chicks = [];
      this.chickCount = [1, 2, 2, 3, 4, 5][level];
      this.invalidFlash = 0;
      this.runBox = { x: 1035, y: 515, w: 190, h: 92 };
      this.changeBox = { x: 1035, y: 620, w: 190, h: 64 };
    }

    cellAt(point) {
      if (!inside(point, this.region)) return null;
      return {
        c: clamp(Math.floor((point.x - this.region.x) / (this.region.w / this.maze.cols)), 0, this.maze.cols - 1),
        r: clamp(Math.floor((point.y - this.region.y) / (this.region.h / this.maze.rows)), 0, this.maze.rows - 1)
      };
    }

    center(cell) {
      const cw = this.region.w / this.maze.cols;
      const ch = this.region.h / this.maze.rows;
      return { x: this.region.x + (cell.c + .5) * cw, y: this.region.y + (cell.r + .5) * ch };
    }

    extendRoute(cell) {
      const origin = this.route[this.route.length - 1];
      const dc = cell.c - origin.c;
      const dr = cell.r - origin.r;
      const steps = Math.max(Math.abs(dc), Math.abs(dr));
      for (let step = 1; step <= steps; step += 1) {
        const next = {
          c: Math.round(origin.c + dc * step / steps),
          r: Math.round(origin.r + dr * step / steps)
        };
        const last = this.route[this.route.length - 1];
        if (last.c === next.c && last.r === next.r) continue;
        const previous = this.route[this.route.length - 2];
        if (previous && previous.c === next.c && previous.r === next.r) {
          this.route.pop();
          this.app.audio.sfx('seed');
          continue;
        }
        if (!mazeCanMove(this.maze, last, next) || this.route.some(item => item.c === next.c && item.r === next.r)) return false;
        this.route.push(next);
        this.app.audio.sfx('seed');
      }
      return true;
    }

    async enableMotion() {
      if (root.DeviceMotionEvent && typeof root.DeviceMotionEvent.requestPermission === 'function') {
        try { await root.DeviceMotionEvent.requestPermission(); } catch (_) {}
      }
    }

    startRun() {
      if (!this.ready || this.running || this.completed) {
        if (!this.ready) this.app.toast('先把种子路线画到鸡舍门口');
        return;
      }
      this.enableMotion();
      this.running = true;
      this.chicks = Array.from({ length: this.chickCount }, (_, index) => ({ progress: -index * .45, finished: false }));
      this.app.audio.sfx('seed');
      this.app.voice('start', '小鸡出发啦！');
    }

    completeLevel() {
      if (this.completed) return;
      this.completed = true;
      this.running = false;
      this.app.store.update(state => {
        state.scores.maze.best[this.level] = Math.max(state.scores.maze.best[this.level], this.chickCount);
        state.scores.maze.totalChicks += this.chickCount;
      });
      const total = this.app.store.state.scores.maze.totalChicks;
      const unlocked = this.app.store.unlockByProgress('maze', total, 20);
      this.app.audio.sfx('correct');
      this.app.voice('success', '成功啦，小鸡都回家了！');
      if (unlocked.length) this.app.award(unlocked);
    }

    handleInput(event) {
      if (event.type !== 'pointerdown' && event.type !== 'pointermove' && event.type !== 'pointerup' && event.type !== 'pointercancel') return;
      if (this.selecting) {
        if (event.type === 'pointerdown') {
          const choice = this.levelBoxes.find(box => inside(event, box));
          if (choice) { this.app.audio.sfx('tap'); this.startLevel(choice.level); }
        }
        return;
      }
      const pointerId = event.pointerId ?? 0;
      if (this.drawing && pointerId !== this.drawingPointerId) return;
      if (this.completed && event.type === 'pointerdown') {
        const buttons = { primary: { x: 405, y: 445, w: 215, h: 76 }, secondary: { x: 660, y: 445, w: 215, h: 76 } };
        if (inside(event, buttons.primary)) this.startLevel((this.level + 1) % 6);
        else if (inside(event, buttons.secondary)) this.app.navigate('menu');
        return;
      }
      if (event.type === 'pointerdown' && inside(event, this.changeBox)) { this.selecting = true; return; }
      if (event.type === 'pointerdown' && inside(event, this.runBox)) { this.startRun(); return; }
      if (this.running) return;
      const cell = this.cellAt(event);
      if (event.type === 'pointerdown') {
        if (cell && cell.c === this.maze.start.c && cell.r === this.maze.start.r) {
          this.route = [cell]; this.drawing = true; this.drawingPointerId = pointerId; this.ready = false; this.app.audio.sfx('seed');
        }
      } else if (event.type === 'pointermove' && this.drawing && cell) {
        const last = this.route[this.route.length - 1];
        if (last.c === cell.c && last.r === cell.r) return;
        if (!this.extendRoute(cell)) {
          this.invalidFlash = .25; this.app.audio.sfx('wrong');
        }
      } else if ((event.type === 'pointerup' || event.type === 'pointercancel') && this.drawing) {
        this.drawing = false;
        this.drawingPointerId = null;
        const last = this.route[this.route.length - 1];
        this.ready = event.type === 'pointerup' && Boolean(last && last.c === this.maze.end.c && last.r === this.maze.end.r);
        if (this.ready) this.app.audio.sfx('correct');
      }
    }

    update(delta) {
      super.update(delta);
      this.invalidFlash = Math.max(0, this.invalidFlash - delta);
      if (!this.running) return;
      const end = this.route.length - 1;
      this.chicks.forEach(chick => {
        chick.progress += delta * 2.75;
        if (chick.progress >= end) chick.finished = true;
      });
      if (this.chicks.length && this.chicks.every(chick => chick.finished)) this.completeLevel();
    }

    drawSelector(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '小鸡迷宫', '按住拖动：沿通道画出不碰墙的路线');
      this.levelBoxes.forEach(box => {
        const best = this.app.store.state.scores.maze.best[box.level];
        Art.drawCard(ctx, box, ['#6ec367','#54b879','#4fb6a1','#4ca6c8','#687fc8','#8a6bc2'][box.level], `第${box.level + 1}关`, best ? `最好：${best}只小鸡` : `${[1,2,2,3,4,5][box.level]}只小鸡`, (draw, x, y, s) => {
          Art.drawChick(draw, x, y + 3, s / 135);
          for (let i = 0; i < box.level; i += 1) Art.drawSeed(draw, x - 56 + i * 20, y + 56, .9);
        });
      });
    }

    render(ctx) {
      if (this.selecting) { this.drawSelector(ctx); return; }
      ctx.fillStyle = this.invalidFlash ? '#f6d779' : '#f1df9a'; ctx.fillRect(0, 0, 1280, 720);
      topTitle(ctx, `小鸡迷宫 · 第${this.level + 1}关`, '按住并拖动，从小鸡画到鸡舍门口');
      const cw = this.region.w / this.maze.cols;
      const ch = this.region.h / this.maze.rows;
      Art.roundedRect(ctx, this.region.x - 12, this.region.y - 12, this.region.w + 24, this.region.h + 24, 24); ctx.fillStyle = '#79c767'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#446d42'; ctx.lineWidth = Math.max(8, 15 - this.level); ctx.lineCap = 'round';
      for (let r = 0; r < this.maze.rows; r += 1) {
        for (let c = 0; c < this.maze.cols; c += 1) {
          const cell = this.maze.cells[r][c];
          const x = this.region.x + c * cw;
          const y = this.region.y + r * ch;
          if (cell.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cw, y); ctx.stroke(); }
          if (cell.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ch); ctx.stroke(); }
          if (r === this.maze.rows - 1 && cell.walls[2]) { ctx.beginPath(); ctx.moveTo(x, y + ch); ctx.lineTo(x + cw, y + ch); ctx.stroke(); }
          if (c === this.maze.cols - 1 && cell.walls[1]) { ctx.beginPath(); ctx.moveTo(x + cw, y); ctx.lineTo(x + cw, y + ch); ctx.stroke(); }
        }
      }
      const start = this.center(this.maze.start);
      const end = this.center(this.maze.end);
      Art.drawChick(ctx, start.x, start.y, Math.min(cw, ch) / 90 * .62, { direction: 1 });
      Art.drawCoop(ctx, end.x, end.y, Math.min(cw, ch) / 190, '#f5c83d');
      this.route.forEach(cell => { const point = this.center(cell); Art.drawSeed(ctx, point.x, point.y, .9); });
      if (this.running || this.completed) {
        this.chicks.forEach((chick, index) => {
          if (chick.progress < 0) return;
          const segment = clamp(Math.floor(chick.progress), 0, this.route.length - 1);
          const next = clamp(segment + 1, 0, this.route.length - 1);
          const amount = clamp(chick.progress - segment, 0, 1);
          const from = this.center(this.route[segment]);
          const to = this.center(this.route[next]);
          Art.drawChick(ctx, lerp(from.x, to.x, amount), lerp(from.y, to.y, amount) - index * 2, .5, { direction: to.x < from.x ? -1 : 1 });
        });
      }
      Art.drawButton(ctx, this.runBox, this.running ? '小鸡出发中' : this.ready ? '倒种子' : '画好路线', this.ready ? '#ef9b3c' : '#a4a8a4', { shadow: this.ready ? '#b96628' : '#777b78', fontSize: 25 });
      Art.drawButton(ctx, this.changeBox, '换一关', '#4e97d8', { shadow: '#2865a4', fontSize: 22 });
      if (this.completed) resultOverlay(ctx, '全部回家啦！', `第${this.level + 1}关：${this.chickCount}只小鸡`, '下一关', '游戏菜单');
    }
  }

  class CoopGame extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.modes = [
        { key: 'yellowFree', title: '黄色鸡舍', subtitle: '自由模式', dual: false, timed: false, color: '#f1bb34' },
        { key: 'yellowTimed', title: '黄色鸡舍', subtitle: '60秒模式', dual: false, timed: true, color: '#e89934' },
        { key: 'dualFree', title: '双色鸡舍', subtitle: '自由模式', dual: true, timed: false, color: '#7cad61' },
        { key: 'dualTimed', title: '双色鸡舍', subtitle: '60秒模式', dual: true, timed: true, color: '#6c83c8' }
      ];
      this.modeBoxes = this.modes.map((mode, index) => ({
        ...mode,
        x: 220 + (index % 2) * 440,
        y: 185 + Math.floor(index / 2) * 235,
        w: 400,
        h: 195
      }));
      this.selecting = true;
      this.app.voice('coop', '鸡蛋可以提前拖进鸡舍。孵化以后，要在小鸡跑掉前把它送回正确颜色的家。');
    }

    startMode(mode) {
      this.selecting = false;
      this.mode = mode;
      this.score = 0;
      this.timeLeft = mode.timed ? 60 : Infinity;
      this.items = [];
      this.released = [];
      this.collected = 0;
      this.spawnClock = .35;
      this.countdown = mode.timed ? 3.15 : 0;
      this.dragging = null;
      this.dragPointerId = null;
      this.dragOrigin = null;
      this.finished = false;
      this.changeBox = { x: 526, y: 638, w: 228, h: 64 };
      this.leftTarget = { x: 32, y: 315, w: 300, h: 330 };
      this.rightTarget = { x: 948, y: 315, w: 300, h: 330 };
      this.app.audio.sfx('correct');
      this.app.voice(mode.timed ? 'countdown' : 'start', mode.timed ? '准备好：三、二、一！' : '开始分类吧！');
    }

    spawn() {
      if (this.items.length >= 8 || this.finished) return;
      const color = this.mode.dual && Math.random() < .5 ? 'red' : 'yellow';
      this.items.push({
        id: `${Date.now()}-${Math.random()}`,
        x: 415 + Math.random() * 445,
        y: 180 + Math.random() * 300,
        age: 0,
        state: 'egg',
        color,
        vx: (Math.random() < .5 ? -1 : 1) * (62 + Math.random() * 32),
        wobble: Math.random() * Math.PI * 2,
        dragging: false
      });
    }

    targetFor(point) {
      if (this.mode.dual) {
        if (inside(point, this.leftTarget)) return 'yellow';
        if (inside(point, this.rightTarget)) return 'red';
      } else if (inside(point, this.rightTarget)) return 'yellow';
      return null;
    }

    releaseCollected() {
      for (let index = 0; index < Math.min(this.collected, 24); index += 1) {
        const fromLeft = !this.mode.dual || index % 2 === 0;
        this.released.push({
          x: fromLeft ? 175 : 1090,
          y: 520 + Math.random() * 60,
          vx: fromLeft ? 150 + Math.random() * 80 : -150 - Math.random() * 80,
          color: fromLeft ? 'yellow' : 'red'
        });
      }
      this.collected = 0;
    }

    scoreCorrect() {
      this.score += 1;
      this.collected += 1;
      this.app.store.update(state => {
        state.scores.coop.best[this.mode.key] = Math.max(state.scores.coop.best[this.mode.key], this.score);
        state.scores.coop.totalCorrect += 1;
      });
      const unlocked = this.app.store.unlockByProgress('coop', this.app.store.state.scores.coop.totalCorrect, 20);
      this.app.audio.sfx('correct');
      if (unlocked.length) this.app.award(unlocked);
    }

    drop(item, point) {
      const target = this.targetFor(point);
      if (!target) return;
      const result = applyCoopDrop(this.score, this.mode.dual, target === item.color);
      if (target === item.color) {
        this.scoreCorrect();
      } else if (result.release) {
        this.score = result.score;
        this.releaseCollected();
        this.app.audio.sfx('wrong');
        this.app.voice('tryagain', '颜色放错啦，收好的小鸡都跑出来了。再试一次！');
      }
      this.items = this.items.filter(candidate => candidate !== item);
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      if (this.dragging) this.dragging.dragging = false;
      this.dragging = null;
      this.dragPointerId = null;
      this.dragOrigin = null;
      this.app.store.update(state => {
        state.scores.coop.best[this.mode.key] = Math.max(state.scores.coop.best[this.mode.key], this.score);
      });
      this.app.audio.sfx('correct');
      this.app.voice('timeup', `时间到，你分好了${this.score}只小鸡。`);
    }

    handleInput(event) {
      if (this.selecting) {
        if (event.type === 'pointerdown') {
          const choice = this.modeBoxes.find(box => inside(event, box));
          if (choice) this.startMode(choice);
        }
        return;
      }
      if (this.finished && event.type === 'pointerdown') {
        const primary = { x: 405, y: 445, w: 215, h: 76 };
        const secondary = { x: 660, y: 445, w: 215, h: 76 };
        if (inside(event, primary)) this.startMode(this.mode);
        else if (inside(event, secondary)) this.app.navigate('menu');
        return;
      }
      if (this.countdown > 0) return;
      const pointerId = event.pointerId ?? 0;
      if (this.dragging && pointerId !== this.dragPointerId) return;
      if (event.type === 'pointerdown' && inside(event, this.changeBox)) {
        this.selecting = true;
        this.items = [];
        return;
      }
      if (event.type === 'pointerdown') {
        const item = this.items.slice().reverse().find(candidate => distance(candidate, event) < (candidate.state === 'egg' ? 48 : 58));
        if (item) {
          this.dragging = item;
          this.dragPointerId = pointerId;
          this.dragOrigin = { x: item.x, y: item.y };
          item.dragging = true;
          item.x = event.x; item.y = event.y;
          this.app.audio.sfx('tap');
        }
      } else if (event.type === 'pointermove' && this.dragging) {
        this.dragging.x = clamp(event.x, 35, 1245);
        this.dragging.y = clamp(event.y, 115, 675);
      } else if (event.type === 'pointercancel' && this.dragging) {
        this.dragging.x = this.dragOrigin.x;
        this.dragging.y = this.dragOrigin.y;
        this.dragging.dragging = false;
        this.dragging = null;
        this.dragPointerId = null;
        this.dragOrigin = null;
      } else if (event.type === 'pointerup' && this.dragging) {
        const item = this.dragging;
        item.dragging = false;
        this.dragging = null;
        this.dragPointerId = null;
        this.dragOrigin = null;
        this.drop(item, event);
      }
    }

    update(delta) {
      super.update(delta);
      if (this.selecting || this.finished) return;
      if (this.countdown > 0) {
        const previous = this.countdown;
        this.countdown = Math.max(0, this.countdown - delta);
        if (previous > 0 && this.countdown === 0) this.app.voice('start', '开始！');
        return;
      }
      if (this.mode.timed) {
        this.timeLeft = Math.max(0, this.timeLeft - delta);
        if (this.timeLeft <= 0) { this.finish(); return; }
      }
      this.spawnClock -= delta;
      if (this.spawnClock <= 0) {
        this.spawn();
        this.spawnClock = 1.15 + Math.random() * .5;
      }
      this.items.forEach(item => {
        if (item.dragging) return;
        item.age += delta;
        item.wobble += delta * 6;
        if (item.state === 'egg' && item.age > 1.85) {
          item.state = 'chick';
          this.app.audio.sfx('crack');
          this.app.audio.sfx('chirp');
        }
        if (item.state === 'chick') {
          item.x += item.vx * delta;
          item.y += Math.sin(item.wobble) * delta * 19;
        }
      });
      this.items = this.items.filter(item => item.x > -90 && item.x < 1370);
      this.released.forEach(chick => { chick.x += chick.vx * delta; });
      this.released = this.released.filter(chick => chick.x > -100 && chick.x < 1380);
    }

    drawSelector(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '鸡舍分类', '抓取拖放：把鸡蛋或小鸡送进正确鸡舍');
      this.modeBoxes.forEach(box => {
        Art.drawCard(ctx, box, box.color, box.title, `${box.subtitle} · 最好 ${this.app.store.state.scores.coop.best[box.key]}`, (draw, x, y, s) => {
          if (box.dual) {
            Art.drawCoop(draw, x - 55, y + 15, s / 245, '#f4c938');
            Art.drawCoop(draw, x + 58, y + 15, s / 245, '#ef7165');
          } else Art.drawCoop(draw, x, y + 14, s / 190, '#f4c938');
        });
      });
    }

    render(ctx) {
      if (this.selecting) { this.drawSelector(ctx); return; }
      Art.drawBackground(ctx, 0);
      ctx.fillStyle = 'rgba(255,246,214,.84)'; ctx.fillRect(335, 0, 610, 720);
      topTitle(ctx, this.mode.title, this.mode.subtitle);
      if (this.mode.dual) {
        Art.drawCoop(ctx, 178, 493, 1.08, '#f4ca38', { label: '黄' });
        Art.drawCoop(ctx, 1093, 493, 1.08, '#ef7065', { label: '红' });
      } else {
        Art.drawCoop(ctx, 1085, 493, 1.15, '#f4ca38', { label: '黄' });
      }
      Art.roundedRect(ctx, 470, 124, 340, 75, 24); ctx.fillStyle = 'rgba(55,67,72,.82)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      Art.text(ctx, `已收好 ${this.score} 只`, 640, 162, 34, { color: '#fff' });
      if (this.mode.timed) {
        Art.roundedRect(ctx, 545, 210, 190, 62, 22); ctx.fillStyle = this.timeLeft < 10 ? '#e95864' : '#4e98d5'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
        Art.text(ctx, `${Math.ceil(this.timeLeft)} 秒`, 640, 241, 30, { color: '#fff' });
      }
      this.items.forEach(item => {
        if (item.state === 'egg') {
          Art.drawEgg(ctx, item.x, item.y + Math.sin(item.wobble) * 4, .92, clamp((item.age - 1.15) / 1.4, 0, .45), item.color === 'red' ? '#ffd3cb' : '#fff9e6');
          if (this.mode.dual) { Art.ellipse(ctx, item.x, item.y + 17, 10, 6, item.color === 'red' ? '#e75b57' : '#e4b52f'); }
        } else {
          Art.drawChick(ctx, item.x, item.y, .72, { direction: item.vx < 0 ? -1 : 1, color: item.color === 'red' ? '#f58b78' : '#ffe34f' });
        }
      });
      this.released.forEach(chick => Art.drawChick(ctx, chick.x, chick.y, .62, { direction: chick.vx < 0 ? -1 : 1, color: chick.color === 'red' ? '#f58b78' : '#ffe34f' }));
      Art.drawButton(ctx, this.changeBox, '换一种模式', '#4a91d4', { shadow: '#28609d', fontSize: 21 });
      if (this.countdown > 0) {
        ctx.fillStyle = 'rgba(30,58,76,.42)'; ctx.fillRect(0, 0, 1280, 720);
        Art.text(ctx, String(Math.max(1, Math.ceil(this.countdown))), 640, 365, 150, { color: '#fff', stroke: '#e75d75', strokeWidth: 14, shadow: true });
      }
      if (this.finished) resultOverlay(ctx, '时间到！', `这一局分好了 ${this.score} 只小鸡`);
    }
  }

  class PuddleGame extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.modes = [
        { key: 'peppaFree', title: '佩奇', subtitle: '自由模式', player: 'peppa', rival: '苏西', timed: false, color: '#ec6487' },
        { key: 'peppaTimed', title: '佩奇', subtitle: '60秒比赛', player: 'peppa', rival: '苏西', timed: true, color: '#d95783' },
        { key: 'georgeFree', title: '乔治', subtitle: '自由模式', player: 'george', rival: '理查德', timed: false, color: '#599bd8' },
        { key: 'georgeTimed', title: '乔治', subtitle: '60秒比赛', player: 'george', rival: '理查德', timed: true, color: '#537fc7' }
      ];
      this.modeBoxes = this.modes.map((mode, index) => ({ ...mode, x: 220 + index % 2 * 440, y: 185 + Math.floor(index / 2) * 235, w: 400, h: 195 }));
      this.selecting = true;
      this.app.voice('puddle', '先选一个泥坑，再连续点击，让佩奇或乔治跳起来。');
    }

    makePuddles() {
      return [
        { id: 1, x: 300, y: 575, scale: 1.15, amount: 1, hits: 0 },
        { id: 2, x: 650, y: 555, scale: .92, amount: 1, hits: 0 },
        { id: 3, x: 980, y: 590, scale: 1.28, amount: 1, hits: 0 }
      ];
    }

    startMode(mode) {
      this.selecting = false;
      this.mode = mode;
      this.score = 0;
      this.rivalScore = 0;
      this.timeLeft = mode.timed ? 60 : Infinity;
      this.puddles = this.makePuddles();
      this.selected = null;
      this.jumpPhase = 0;
      this.splashPhase = 0;
      this.rivalClock = .65 + Math.random() * .5;
      this.countdown = mode.timed ? 3.15 : 0;
      this.respawnClock = 0;
      this.finished = false;
      this.changeBox = { x: 526, y: 638, w: 228, h: 64 };
      this.app.audio.sfx('correct');
      this.app.voice(mode.timed ? 'countdown' : 'start', mode.timed ? '准备好：三、二、一！' : '选一个泥坑开始跳吧！');
    }

    jump() {
      if (!this.selected || this.jumpPhase > .11 || this.finished) return;
      this.jumpPhase = .48;
      this.splashPhase = .42;
      this.selected.hits += 1;
      this.selected.amount = Math.max(0, 1 - this.selected.hits / 6);
      this.score += 1;
      this.app.store.update(state => {
        state.scores.puddle.best[this.mode.key] = Math.max(state.scores.puddle.best[this.mode.key], this.score);
        state.scores.puddle.totalJumps += 1;
      });
      const unlocked = this.app.store.unlockByProgress('puddle', this.app.store.state.scores.puddle.totalJumps, 50);
      this.app.audio.sfx('jump');
      if (unlocked.length) this.app.award(unlocked);
      if (this.selected.amount <= 0) this.respawnClock = .62;
    }

    replacePuddle() {
      const old = this.selected;
      if (!old) return;
      const random = seededRandom(Math.floor(this.elapsed * 1000) + this.score * 73);
      old.x = 220 + random() * 830;
      old.y = 520 + random() * 95;
      old.scale = .78 + random() * .62;
      old.amount = 1;
      old.hits = 0;
      this.selected = null;
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      this.app.store.update(state => { state.scores.puddle.best[this.mode.key] = Math.max(state.scores.puddle.best[this.mode.key], this.score); });
      this.app.audio.sfx(this.score >= this.rivalScore ? 'correct' : 'wrong');
      this.app.voice('timeup', `时间到，你跳了${this.score}次。`);
    }

    handleInput(event) {
      if (this.selecting) {
        if (event.type === 'pointerdown') {
          const choice = this.modeBoxes.find(box => inside(event, box));
          if (choice) this.startMode(choice);
        }
        return;
      }
      if (this.finished && event.type === 'pointerdown') {
        const primary = { x: 405, y: 445, w: 215, h: 76 };
        const secondary = { x: 660, y: 445, w: 215, h: 76 };
        if (inside(event, primary)) this.startMode(this.mode);
        else if (inside(event, secondary)) this.app.navigate('menu');
        return;
      }
      if (this.countdown > 0) return;
      if (event.type !== 'pointerdown') return;
      if (inside(event, this.changeBox)) { this.selecting = true; return; }
      const puddle = this.puddles.slice().reverse().find(item => Math.hypot(event.x - item.x, event.y - item.y) < 105 * item.scale);
      if (!puddle || puddle.amount <= 0) return;
      if (this.selected !== puddle) {
        this.selected = puddle;
        this.app.audio.sfx('tap');
        this.app.toast('选好泥坑啦，再点一下开始跳');
      } else this.jump();
    }

    update(delta) {
      super.update(delta);
      if (this.selecting || this.finished) return;
      if (this.countdown > 0) {
        const previous = this.countdown;
        this.countdown = Math.max(0, this.countdown - delta);
        if (previous > 0 && this.countdown === 0) this.app.voice('start', '开始！');
        return;
      }
      this.jumpPhase = Math.max(0, this.jumpPhase - delta);
      this.splashPhase = Math.max(0, this.splashPhase - delta);
      if (this.respawnClock > 0) {
        this.respawnClock -= delta;
        if (this.respawnClock <= 0) this.replacePuddle();
      }
      this.rivalClock -= delta;
      if (this.rivalClock <= 0) {
        this.rivalScore += 1;
        this.rivalClock = (this.mode.timed ? .65 : .95) + Math.random() * .65;
      }
      if (this.mode.timed) {
        this.timeLeft = Math.max(0, this.timeLeft - delta);
        if (this.timeLeft <= 0) this.finish();
      }
    }

    drawSelector(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '泥坑跳跃', '目标选择与连续点击：先选泥坑，再保持节奏');
      this.modeBoxes.forEach(box => {
        Art.drawCard(ctx, box, box.color, box.title, `${box.subtitle} · 最好 ${this.app.store.state.scores.puddle.best[box.key]}`, (draw, x, y, s) => {
          Art.drawPuddle(draw, x, y + 40, s / 150, 1);
          Art.drawPig(draw, x, y - 5, s / 245, { outfit: box.player === 'peppa' ? '#ed5578' : '#4f99d7', muddy: true });
        });
      });
    }

    render(ctx) {
      if (this.selecting) { this.drawSelector(ctx); return; }
      Art.drawBackground(ctx, 5);
      topTitle(ctx, `${this.mode.title}跳泥坑`, `${this.mode.title} 对 ${this.mode.rival}`);
      this.puddles.forEach(puddle => {
        if (puddle.amount > 0) Art.drawPuddle(ctx, puddle.x, puddle.y, puddle.scale, puddle.amount);
        if (this.selected === puddle && puddle.amount > 0) {
          ctx.beginPath(); ctx.arc(puddle.x, puddle.y - 7, 105 * puddle.scale, 0, Math.PI * 2); ctx.strokeStyle = '#ffe150'; ctx.lineWidth = 9; ctx.setLineDash([16, 12]); ctx.stroke(); ctx.setLineDash([]);
        }
      });
      const base = this.selected || { x: 260, y: 580 };
      const progress = this.jumpPhase > 0 ? 1 - this.jumpPhase / .48 : 0;
      const bounce = this.jumpPhase > 0 ? Math.sin(progress * Math.PI) * 115 : 0;
      Art.drawPig(ctx, base.x, base.y - 95 - bounce, this.mode.player === 'peppa' ? .82 : .68, { outfit: this.mode.player === 'peppa' ? '#ed5578' : '#4f99d7', muddy: true });
      if (this.splashPhase > 0) {
        const amount = this.splashPhase / .42;
        for (let i = 0; i < 8; i += 1) {
          const angle = Math.PI + i * Math.PI / 7;
          Art.ellipse(ctx, base.x + Math.cos(angle) * (80 + (1 - amount) * 60), base.y + Math.sin(angle) * 30 - (1 - amount) * 45, 10 * amount, 6 * amount, '#7d513c');
        }
      }
      const rivalOutfit = this.mode.player === 'peppa' ? '#9b78cf' : '#6cbf6a';
      Art.drawPig(ctx, 1130, 515 - Math.abs(Math.sin(this.elapsed * 4.2)) * 58, this.mode.player === 'peppa' ? .72 : .62, { outfit: rivalOutfit, skin: this.mode.player === 'peppa' ? '#eee1db' : '#f1e5d8', muddy: true, direction: -1 });
      panel(ctx, 445, 135, 390, 93, 'rgba(255,248,223,.9)');
      Art.text(ctx, `${this.mode.title} ${this.score}  :  ${this.rivalScore} ${this.mode.rival}`, 640, 181, 30, { color: '#6c4b40' });
      if (this.mode.timed) {
        Art.roundedRect(ctx, 552, 244, 176, 58, 20); ctx.fillStyle = this.timeLeft < 10 ? '#e65b69' : '#4a91d4'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
        Art.text(ctx, `${Math.ceil(this.timeLeft)} 秒`, 640, 273, 28, { color: '#fff' });
      }
      if (!this.selected) Art.text(ctx, '先选一个泥坑', 640, 620, 27, { color: '#fff', stroke: 'rgba(61,45,38,.45)', strokeWidth: 4 });
      Art.drawButton(ctx, this.changeBox, '换一种模式', '#4a91d4', { shadow: '#28609d', fontSize: 21 });
      if (this.countdown > 0) {
        ctx.fillStyle = 'rgba(30,58,76,.38)'; ctx.fillRect(0, 0, 1280, 720);
        Art.text(ctx, String(Math.max(1, Math.ceil(this.countdown))), 640, 365, 150, { color: '#fff', stroke: '#e75d75', strokeWidth: 14, shadow: true });
      }
      if (this.finished) resultOverlay(ctx, this.score >= this.rivalScore ? '你赢啦！' : '比赛结束！', `${this.mode.title} ${this.score} 次 · ${this.mode.rival} ${this.rivalScore} 次`);
    }
  }

  function puzzleEdgeSign(row, col, edge, cols) {
    const rawRight = (row * 17 + col * 31) % 2 ? 1 : -1;
    const rawBottom = (row * 29 + col * 13 + 1) % 2 ? 1 : -1;
    if (edge === 'right') return rawRight;
    if (edge === 'bottom') return rawBottom;
    if (edge === 'left') return -((row * 17 + (col - 1) * 31) % 2 ? 1 : -1);
    return -(((row - 1) * 29 + col * 13 + 1) % 2 ? 1 : -1);
  }

  function piecePath(ctx, piece) {
    const { w, h, row, col, rows, cols } = piece;
    const tab = Math.min(w, h) * .18;
    const top = row === 0 ? 0 : puzzleEdgeSign(row, col, 'top', cols);
    const right = col === cols - 1 ? 0 : puzzleEdgeSign(row, col, 'right', cols);
    const bottom = row === rows - 1 ? 0 : puzzleEdgeSign(row, col, 'bottom', cols);
    const left = col === 0 ? 0 : puzzleEdgeSign(row, col, 'left', cols);
    if (typeof ctx.beginPath === 'function') ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * .36, 0);
    if (top) ctx.bezierCurveTo(w * .38, -tab * top, w * .62, -tab * top, w * .64, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * .36);
    if (right) ctx.bezierCurveTo(w + tab * right, h * .38, w + tab * right, h * .62, w, h * .64);
    ctx.lineTo(w, h);
    ctx.lineTo(w * .64, h);
    if (bottom) ctx.bezierCurveTo(w * .62, h + tab * bottom, w * .38, h + tab * bottom, w * .36, h);
    ctx.lineTo(0, h);
    ctx.lineTo(0, h * .64);
    if (left) ctx.bezierCurveTo(-tab * left, h * .62, -tab * left, h * .38, 0, h * .36);
    ctx.closePath();
  }

  class PuzzleGame extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.stage = 'scenes';
      this.sceneBoxes = Array.from({ length: 4 }, (_, index) => ({ x: 70 + index * 302, y: 190, w: 265, h: 205, sceneId: index }));
      this.difficultyBoxes = [4, 9, 16].map((count, index) => ({ x: 805, y: 185 + index * 145, w: 360, h: 112, count }));
      this.app.voice('puzzle', '先选一幅图，再选择四片、九片或十六片。拖近正确位置，拼图片会自动吸住。');
    }

    startPuzzle(count) {
      this.stage = 'playing';
      this.count = count;
      this.rows = Math.sqrt(count);
      this.cols = this.rows;
      this.board = { x: 70, y: 176, w: 640, h: 360 };
      this.source = document.createElement('canvas');
      this.source.width = this.board.w;
      this.source.height = this.board.h;
      Art.drawPuzzleScene(this.source.getContext('2d'), this.sceneId, 0, 0, this.board.w, this.board.h);
      const random = seededRandom(8101 + this.sceneId * 277 + count * 43);
      const w = this.board.w / this.cols;
      const h = this.board.h / this.rows;
      const pieces = [];
      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          pieces.push({
            id: row * this.cols + col,
            row, col, rows: this.rows, cols: this.cols, w, h,
            homeX: this.board.x + col * w,
            homeY: this.board.y + row * h,
            x: 755 + random() * Math.max(10, 475 - w),
            y: 158 + random() * Math.max(10, 495 - h),
            placed: false
          });
        }
      }
      this.pieces = shuffle(pieces, random);
      this.dragging = null;
      this.dragPointerId = null;
      this.dragOrigin = null;
      this.offset = { x: 0, y: 0 };
      this.completed = false;
      this.changeBox = { x: 885, y: 638, w: 270, h: 64 };
      this.app.audio.sfx('tap');
    }

    finishPuzzle() {
      if (this.completed) return;
      this.completed = true;
      const key = `${this.sceneId}-${this.count}`;
      this.app.store.update(state => {
        state.scores.puzzle.completed[key] = (state.scores.puzzle.completed[key] || 0) + 1;
        state.scores.puzzle.totalCompleted += 1;
      });
      const unlocked = this.app.store.unlockByProgress('puzzle', this.app.store.state.scores.puzzle.totalCompleted, 1);
      this.app.audio.sfx('reward');
      this.app.voice('success', '拼图完成啦！');
      if (unlocked.length) this.app.award(unlocked);
    }

    hitPiece(point) {
      return this.pieces.slice().reverse().find(piece => {
        if (piece.placed) return false;
        if (typeof root.Path2D === 'function' && typeof this.runtime.ctx.isPointInPath === 'function') {
          const path = new root.Path2D();
          piecePath(path, piece);
          return this.runtime.ctx.isPointInPath(path, point.x - piece.x, point.y - piece.y);
        }
        return point.x >= piece.x && point.x <= piece.x + piece.w && point.y >= piece.y && point.y <= piece.y + piece.h;
      });
    }

    handleInput(event) {
      if (this.stage === 'scenes') {
        if (event.type === 'pointerdown') {
          const selected = this.sceneBoxes.find(box => inside(event, box));
          if (selected) { this.sceneId = selected.sceneId; this.stage = 'difficulty'; this.app.audio.sfx('tap'); }
        }
        return;
      }
      if (this.stage === 'difficulty') {
        if (event.type === 'pointerdown') {
          const selected = this.difficultyBoxes.find(box => inside(event, box));
          if (selected) this.startPuzzle(selected.count);
          else if (inside(event, { x: 90, y: 610, w: 245, h: 70 })) this.stage = 'scenes';
        }
        return;
      }
      if (this.completed && event.type === 'pointerdown') {
        const primary = { x: 405, y: 445, w: 215, h: 76 };
        const secondary = { x: 660, y: 445, w: 215, h: 76 };
        if (inside(event, primary)) this.startPuzzle(this.count);
        else if (inside(event, secondary)) this.app.navigate('menu');
        return;
      }
      const pointerId = event.pointerId ?? 0;
      if (this.dragging && pointerId !== this.dragPointerId) return;
      if (event.type === 'pointerdown' && inside(event, this.changeBox)) { this.stage = 'scenes'; return; }
      if (event.type === 'pointerdown') {
        const piece = this.hitPiece(event);
        if (!piece) return;
        this.dragging = piece;
        this.dragPointerId = pointerId;
        this.dragOrigin = { x: piece.x, y: piece.y };
        this.offset = { x: event.x - piece.x, y: event.y - piece.y };
        this.pieces = this.pieces.filter(candidate => candidate !== piece).concat(piece);
        this.app.audio.sfx('tap');
      } else if (event.type === 'pointermove' && this.dragging) {
        this.dragging.x = clamp(event.x - this.offset.x, -25, 1280 - this.dragging.w + 25);
        this.dragging.y = clamp(event.y - this.offset.y, 115, 720 - this.dragging.h + 20);
      } else if (event.type === 'pointercancel' && this.dragging) {
        this.dragging.x = this.dragOrigin.x;
        this.dragging.y = this.dragOrigin.y;
        this.dragging = null;
        this.dragPointerId = null;
        this.dragOrigin = null;
      } else if (event.type === 'pointerup' && this.dragging) {
        const piece = this.dragging;
        this.dragging = null;
        this.dragPointerId = null;
        this.dragOrigin = null;
        if (shouldSnap(piece, Math.min(48, piece.w * .25))) {
          piece.x = piece.homeX; piece.y = piece.homeY; piece.placed = true;
          this.app.audio.sfx('snap');
          if (this.pieces.every(candidate => candidate.placed)) this.finishPuzzle();
        }
      }
    }

    drawScenes(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '快乐拼图', '精准拖放：把拼图片送到正确位置');
      this.sceneBoxes.forEach(box => {
        panel(ctx, box.x, box.y, box.w, box.h, '#fff6dc');
        Art.drawPuzzleScene(ctx, box.sceneId, box.x + 12, box.y + 12, box.w - 24, box.h - 51);
        Art.text(ctx, ['快乐小鸡','草地野餐','泥坑比赛','夕阳鸡舍'][box.sceneId], box.x + box.w / 2, box.y + box.h - 20, 21, { color: '#6a5041' });
      });
      Art.text(ctx, '每幅图都有 4片、9片、16片 三种难度', 640, 500, 27, { color: '#fff' });
      const completed = Object.keys(this.app.store.state.scores.puzzle.completed).length;
      Art.text(ctx, `已经完成 ${completed}/12 种拼图`, 640, 560, 24, { color: '#d9f4ff', weight: 650 });
    }

    drawDifficulty(ctx) {
      Art.drawBluePattern(ctx);
      topTitle(ctx, '选择拼图片数', '片数越多，拼图越有挑战');
      panel(ctx, 92, 175, 620, 375, '#fff6dc');
      Art.drawPuzzleScene(ctx, this.sceneId, 108, 191, 588, 331);
      this.difficultyBoxes.forEach((box, index) => {
        const key = `${this.sceneId}-${box.count}`;
        const times = this.app.store.state.scores.puzzle.completed[key] || 0;
        Art.drawButton(ctx, box, `${box.count}片拼图`, ['#69bd62','#4da7cf','#8a6bc6'][index], { shadow: ['#3d8b42','#2d7197','#604594'][index], fontSize: 30 });
        if (times) Art.text(ctx, `完成 ${times} 次`, box.x + box.w - 60, box.y + 86, 15, { color: '#fff3a4', weight: 700 });
      });
      Art.drawButton(ctx, { x: 90, y: 610, w: 245, h: 70 }, '重选图片', '#4b91d4', { shadow: '#28609e', fontSize: 23 });
    }

    drawPiece(ctx, piece) {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      if (!piece.placed) {
        ctx.shadowColor = 'rgba(42,48,59,.35)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 6;
      }
      piecePath(ctx, piece);
      ctx.save(); ctx.clip();
      ctx.drawImage(this.source, -piece.col * piece.w, -piece.row * piece.h, this.board.w, this.board.h);
      ctx.restore();
      piecePath(ctx, piece);
      ctx.strokeStyle = piece.placed ? 'rgba(255,255,255,.65)' : '#fff';
      ctx.lineWidth = piece.placed ? 2 : 5;
      ctx.stroke();
      ctx.restore();
    }

    render(ctx) {
      if (this.stage === 'scenes') { this.drawScenes(ctx); return; }
      if (this.stage === 'difficulty') { this.drawDifficulty(ctx); return; }
      ctx.fillStyle = '#f0d58d'; ctx.fillRect(0, 0, 1280, 720);
      topTitle(ctx, `${this.count}片拼图`, '精准拖放：把拼图片拖到左边的淡色图案上');
      panel(ctx, this.board.x - 12, this.board.y - 12, this.board.w + 24, this.board.h + 24, '#fff8e2');
      ctx.save(); ctx.globalAlpha = .2; ctx.drawImage(this.source, this.board.x, this.board.y, this.board.w, this.board.h); ctx.restore();
      ctx.strokeStyle = 'rgba(94,70,53,.22)'; ctx.lineWidth = 2;
      for (let col = 1; col < this.cols; col += 1) { ctx.beginPath(); ctx.moveTo(this.board.x + col * this.board.w / this.cols, this.board.y); ctx.lineTo(this.board.x + col * this.board.w / this.cols, this.board.y + this.board.h); ctx.stroke(); }
      for (let row = 1; row < this.rows; row += 1) { ctx.beginPath(); ctx.moveTo(this.board.x, this.board.y + row * this.board.h / this.rows); ctx.lineTo(this.board.x + this.board.w, this.board.y + row * this.board.h / this.rows); ctx.stroke(); }
      this.pieces.filter(piece => piece.placed).forEach(piece => this.drawPiece(ctx, piece));
      this.pieces.filter(piece => !piece.placed).forEach(piece => this.drawPiece(ctx, piece));
      const placed = this.pieces.filter(piece => piece.placed).length;
      Art.roundedRect(ctx, 930, 85, 230, 62, 21); ctx.fillStyle = '#4a91d4'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      Art.text(ctx, `${placed} / ${this.count}`, 1045, 116, 29, { color: '#fff' });
      Art.drawButton(ctx, this.changeBox, '换一幅拼图', '#4a91d4', { shadow: '#28609e', fontSize: 23 });
      if (this.completed) resultOverlay(ctx, '拼图完成！', `这幅${this.count}片拼图已经完成`, '再拼一次', '游戏菜单');
    }
  }

  class StickerBook extends P.Scene {
    enter(runtime) {
      super.enter(runtime);
      this.background = 0;
      this.page = 0;
      this.dragging = null;
      this.prevBackground = { x: 420, y: 18, w: 72, h: 64 };
      this.nextBackground = { x: 788, y: 18, w: 72, h: 64 };
      this.prevPage = { x: 18, y: 612, w: 72, h: 86 };
      this.nextPage = { x: 1190, y: 612, w: 72, h: 86 };
      this.backgroundNames = ['春日草地','温暖卧室','快乐游戏房','鲜花花园','小鸡农场','雨后泥坑','绿色公园','星星夜晚'];
      this.app.voice('stickers', '把贴纸从下面拖到画面里。贴纸可以用很多次，拖回贴纸栏就会删除。');
    }

    get instances() { return this.app.store.state.stickers.canvases[this.background]; }
    get unlocked() { return this.app.store.state.stickers.unlocked; }
    get pageCount() { return Math.max(1, Math.ceil(this.unlocked.length / 8)); }

    ensurePage() {
      this.page = ((this.page % this.pageCount) + this.pageCount) % this.pageCount;
    }

    trayEntries() {
      this.ensurePage();
      const start = this.page * 8;
      return this.unlocked.slice(start, start + 8).map((stickerId, index) => ({
        stickerId,
        x: 145 + index * 124,
        y: 652,
        radius: 50
      }));
    }

    save() {
      this.instances.forEach((item, index) => { item.z = index; });
      this.app.store.save();
    }

    changeBackground(direction) {
      if (this.dragging) return;
      this.background = (this.background + direction + 8) % 8;
      this.app.audio.sfx('tap');
    }

    handleInput(event) {
      this.ensurePage();
      const pointerId = event.pointerId ?? 0;
      if (this.dragging && pointerId !== this.dragging.pointerId) return;
      if (event.type === 'pointerdown') {
        if (inside(event, this.prevBackground)) { this.changeBackground(-1); return; }
        if (inside(event, this.nextBackground)) { this.changeBackground(1); return; }
        if (inside(event, this.prevPage)) { this.page = (this.page - 1 + this.pageCount) % this.pageCount; this.app.audio.sfx('tap'); return; }
        if (inside(event, this.nextPage)) { this.page = (this.page + 1) % this.pageCount; this.app.audio.sfx('tap'); return; }
        const tray = this.trayEntries().find(entry => distance(entry, event) <= entry.radius);
        if (tray) {
          this.dragging = {
            isNew: true,
            pointerId,
            item: { id: `sticker-${Date.now()}-${Math.floor(Math.random() * 100000)}`, stickerId: tray.stickerId, x: event.x, y: event.y, scale: 1, rotation: (Math.random() - .5) * .18, z: this.instances.length }
          };
          this.app.audio.sfx('tap');
          return;
        }
        const item = this.instances.slice().reverse().find(candidate => Math.hypot(event.x - candidate.x, event.y - candidate.y) < 58 * candidate.scale);
        if (item) {
          const index = this.instances.indexOf(item);
          this.instances.splice(index, 1);
          this.instances.push(item);
          this.dragging = { isNew: false, pointerId, item, origin: { x: item.x, y: item.y } };
          item.x = event.x; item.y = event.y;
          this.app.audio.sfx('tap');
        }
      } else if (event.type === 'pointermove' && this.dragging) {
        this.dragging.item.x = clamp(event.x, 25, 1255);
        this.dragging.item.y = clamp(event.y, 88, 690);
      } else if (event.type === 'pointercancel' && this.dragging) {
        const { item, isNew, origin } = this.dragging;
        this.dragging = null;
        if (!isNew) {
          item.x = origin.x;
          item.y = origin.y;
          this.save();
        }
      } else if (event.type === 'pointerup' && this.dragging) {
        const { item, isNew } = this.dragging;
        this.dragging = null;
        if (event.y >= 578) {
          if (!isNew) {
            const index = this.instances.indexOf(item);
            if (index >= 0) this.instances.splice(index, 1);
          }
          this.app.audio.sfx('wrong');
        } else {
          item.x = clamp(item.x, 42, 1238);
          item.y = clamp(item.y, 100, 550);
          if (isNew) this.instances.push(item);
          this.app.audio.sfx('snap');
        }
        this.save();
      }
    }

    render(ctx) {
      Art.drawBackground(ctx, this.background, 0, 0, 1280, 585);
      ctx.fillStyle = 'rgba(38,71,99,.72)';
      Art.roundedRect(ctx, 394, 12, 492, 78, 28); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
      Art.text(ctx, this.backgroundNames[this.background], 640, 41, 31, { color: '#fff' });
      Art.text(ctx, `${this.background + 1} / 8`, 640, 72, 16, { color: '#dff4ff', weight: 650 });
      Art.drawButton(ctx, this.prevBackground, '‹', '#4b91d4', { shadow: '#28609d', fontSize: 44, radius: 24 });
      Art.drawButton(ctx, this.nextBackground, '›', '#4b91d4', { shadow: '#28609d', fontSize: 44, radius: 24 });
      this.instances.forEach(item => {
        if (!this.dragging || this.dragging.item !== item) Art.drawSticker(ctx, item.stickerId, item.x, item.y, 92 * item.scale, item.rotation);
      });
      if (this.dragging) Art.drawSticker(ctx, this.dragging.item.stickerId, this.dragging.item.x, this.dragging.item.y, 98 * this.dragging.item.scale, this.dragging.item.rotation);
      ctx.fillStyle = 'rgba(255,248,223,.97)'; ctx.fillRect(0, 585, 1280, 135);
      ctx.fillStyle = '#e8bd6c'; ctx.fillRect(0, 585, 1280, 9);
      this.trayEntries().forEach(entry => {
        Art.roundedRect(ctx, entry.x - 51, 600, 102, 105, 22); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#e7cf9d'; ctx.lineWidth = 4; ctx.stroke();
        Art.drawSticker(ctx, entry.stickerId, entry.x, entry.y, 76);
      });
      Art.drawButton(ctx, this.prevPage, '‹', '#ef6682', { shadow: '#b33e5c', fontSize: 45, radius: 24 });
      Art.drawButton(ctx, this.nextPage, '›', '#ef6682', { shadow: '#b33e5c', fontSize: 45, radius: 24 });
      Art.text(ctx, `${this.unlocked.length}/45`, 1130, 603, 16, { color: '#8c6c54', weight: 750 });
      Art.text(ctx, `${this.page + 1}/${this.pageCount}`, 1130, 700, 16, { color: '#8c6c54', weight: 750 });
      if (!this.instances.length && !this.dragging) Art.text(ctx, '自由拖放：从下面拖一枚贴纸到画面里', 640, 535, 25, { color: '#fff', stroke: 'rgba(48,61,68,.42)', strokeWidth: 4 });
      if (this.dragging && this.dragging.item.y >= 578) Art.text(ctx, '松手删除这枚贴纸', 640, 556, 24, { color: '#e85870', stroke: '#fff', strokeWidth: 4 });
    }
  }

  Games.StartScene = StartScene;
  Games.MenuScene = MenuScene;
  Games.EggGame = EggGame;
  Games.MazeGame = MazeGame;
  Games.CoopGame = CoopGame;
  Games.PuddleGame = PuddleGame;
  Games.PuzzleGame = PuzzleGame;
  Games.StickerBook = StickerBook;
})(window);
