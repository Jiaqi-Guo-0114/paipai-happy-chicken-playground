(function (root) {
  'use strict';

  const P = root.Paipai;
  const { clamp } = P.Utils;
  const Art = P.Art = {};
  const INK = '#5b3b2e';

  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return ctx;
  }

  function ellipse(ctx, x, y, rx, ry, fill, stroke = null, lineWidth = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function line(ctx, points, color = INK, width = 5, cap = 'round') {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = cap;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function text(ctx, value, x, y, size, options = {}) {
    value = P.I18n ? P.I18n.text(value) : String(value);
    ctx.save();
    ctx.font = `${options.weight || 800} ${size}px ${options.family || '"PingFang SC", "Microsoft YaHei", sans-serif'}`;
    ctx.textAlign = options.align || 'center';
    ctx.textBaseline = options.baseline || 'middle';
    if (options.shadow) {
      ctx.shadowColor = options.shadowColor || 'rgba(45,52,70,.25)';
      ctx.shadowBlur = options.shadowBlur || 0;
      ctx.shadowOffsetY = options.shadowY || 5;
    }
    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.strokeWidth || Math.max(3, size * .09);
      ctx.lineJoin = 'round';
      ctx.strokeText(value, x, y, options.maxWidth || 1180);
    }
    ctx.fillStyle = options.color || '#fff';
    ctx.fillText(value, x, y, options.maxWidth || 1180);
    ctx.restore();
  }

  function starPath(ctx, x, y, outer, inner = outer * .48, points = 5) {
    ctx.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / points;
      const radius = index % 2 ? inner : outer;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (!index) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function heartPath(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y + size * .42);
    ctx.bezierCurveTo(x - size * .72, y, x - size * .45, y - size * .54, x, y - size * .17);
    ctx.bezierCurveTo(x + size * .45, y - size * .54, x + size * .72, y, x, y + size * .42);
    ctx.closePath();
  }

  function cloud(ctx, x, y, scale = 1, color = '#fff') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x - 46 * scale, y + 10 * scale, 28 * scale, 0, Math.PI * 2);
    ctx.arc(x - 13 * scale, y - 6 * scale, 37 * scale, 0, Math.PI * 2);
    ctx.arc(x + 28 * scale, y + 4 * scale, 31 * scale, 0, Math.PI * 2);
    ctx.arc(x + 51 * scale, y + 18 * scale, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function flower(ctx, x, y, size, petal = '#ff82ad', center = '#ffd23f') {
    ctx.save();
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      ellipse(ctx, x + Math.cos(angle) * size * .33, y + Math.sin(angle) * size * .33, size * .24, size * .34, petal);
    }
    ellipse(ctx, x, y, size * .25, size * .25, center, INK, size * .055);
    ctx.restore();
  }

  function drawButton(ctx, box, label, color = '#ee5e7d', options = {}) {
    ctx.save();
    const shadow = options.shadow || '#ad3857';
    roundedRect(ctx, box.x, box.y + 8, box.w, box.h, options.radius || 28);
    ctx.fillStyle = shadow;
    ctx.fill();
    roundedRect(ctx, box.x, box.y, box.w, box.h, options.radius || 28);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = options.border || '#fff';
    ctx.lineWidth = options.borderWidth || 6;
    ctx.stroke();
    if (options.icon) options.icon(ctx, box.x + 48, box.y + box.h / 2);
    text(ctx, label, box.x + box.w / 2 + (options.icon ? 18 : 0), box.y + box.h / 2 + 1, options.fontSize || Math.min(34, box.h * .42), {
      color: options.textColor || '#fff', stroke: options.textStroke || 'rgba(80,43,45,.24)', strokeWidth: 3,
      maxWidth: box.w - 20
    });
    ctx.restore();
    return box;
  }

  function drawCard(ctx, box, color, title, subtitle, icon) {
    ctx.save();
    roundedRect(ctx, box.x, box.y + 9, box.w, box.h, 30);
    ctx.fillStyle = 'rgba(21,55,95,.25)';
    ctx.fill();
    roundedRect(ctx, box.x, box.y, box.w, box.h, 30);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 7;
    ctx.stroke();
    roundedRect(ctx, box.x + 14, box.y + 14, box.w - 28, box.h * .56, 22);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fill();
    if (icon) icon(ctx, box.x + box.w / 2, box.y + box.h * .31, Math.min(box.w, box.h) * .36);
    text(ctx, title, box.x + box.w / 2, box.y + box.h * .70, 31, { color: '#fff', stroke: 'rgba(70,44,45,.24)', strokeWidth: 3, maxWidth: box.w - 24 });
    if (subtitle) text(ctx, subtitle, box.x + box.w / 2, box.y + box.h * .87, 17, { color: 'rgba(255,255,255,.96)', weight: 650, maxWidth: box.w - 24 });
    ctx.restore();
  }

  function drawBluePattern(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 720);
    gradient.addColorStop(0, '#2c98dc');
    gradient.addColorStop(1, '#2379c3');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.save();
    ctx.globalAlpha = .11;
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 12; col += 1) {
        const x = col * 120 + (row % 2) * 60;
        const y = row * 112 + 25;
        if ((row + col) % 3 === 0) {
          starPath(ctx, x, y, 22, 10);
          ctx.fillStyle = '#fff'; ctx.fill();
        } else if ((row + col) % 3 === 1) {
          ellipse(ctx, x, y, 28, 18, '#fff');
          ellipse(ctx, x + 23, y, 15, 10, '#fff');
        } else {
          flower(ctx, x, y, 28, '#fff', '#fff');
        }
      }
    }
    ctx.restore();
  }

  function drawLandscape(ctx, options = {}) {
    const sky = options.sky || '#46b7ed';
    const grass = options.grass || '#7bcf66';
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 720);
    ellipse(ctx, options.sunX || 1090, options.sunY || 100, 54, 54, '#ffe45a');
    cloud(ctx, 190, 105, .9, 'rgba(255,255,255,.92)');
    cloud(ctx, 700, 78, .65, 'rgba(255,255,255,.86)');
    ctx.fillStyle = '#62b85b';
    ctx.beginPath();
    ctx.moveTo(0, 430);
    ctx.quadraticCurveTo(220, 290, 480, 440);
    ctx.quadraticCurveTo(780, 255, 1280, 430);
    ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.moveTo(0, 490);
    ctx.quadraticCurveTo(300, 405, 610, 500);
    ctx.quadraticCurveTo(920, 405, 1280, 485);
    ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();
    for (let index = 0; index < 18; index += 1) {
      const x = 30 + (index * 83) % 1220;
      const y = 530 + (index * 67) % 165;
      line(ctx, [{ x, y: y + 16 }, { x, y }], '#3f9f4d', 4);
      flower(ctx, x, y, 8 + index % 3, ['#fff', '#ff8eb8', '#ffe35a'][index % 3], '#f7ad34');
    }
  }

  function drawFence(ctx, y = 530, color = '#fff4d6') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    for (let x = 30; x < 1280; x += 96) {
      ctx.beginPath(); ctx.moveTo(x, y - 45); ctx.lineTo(x, y + 75); ctx.stroke();
    }
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(0, y - 12); ctx.lineTo(1280, y - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + 42); ctx.lineTo(1280, y + 42); ctx.stroke();
    ctx.restore();
  }

  function drawPig(ctx, x, y, scale = 1, options = {}) {
    const skin = options.skin || '#f5a5bd';
    const outfit = options.outfit || '#ed5271';
    const direction = options.direction === -1 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction * scale, scale);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    line(ctx, [{ x: -18, y: 54 }, { x: -21, y: 84 }], INK, 5);
    line(ctx, [{ x: 18, y: 54 }, { x: 24, y: 84 }], INK, 5);
    line(ctx, [{ x: -21, y: 84 }, { x: -36, y: 86 }], INK, 5);
    line(ctx, [{ x: 24, y: 84 }, { x: 38, y: 86 }], INK, 5);
    roundedRect(ctx, -42, -5, 84, 69, 34); ctx.fillStyle = outfit; ctx.fill(); ctx.stroke();
    ellipse(ctx, 0, -50, 48, 42, skin, INK, 5);
    ellipse(ctx, 43, -45, 27, 20, skin, INK, 5);
    ellipse(ctx, 49, -47, 4, 6, '#c86281');
    ellipse(ctx, 61, -43, 4, 6, '#c86281');
    ctx.beginPath(); ctx.moveTo(-25, -83); ctx.lineTo(-14, -116); ctx.lineTo(1, -82); ctx.closePath(); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -87); ctx.lineTo(17, -115); ctx.lineTo(27, -78); ctx.closePath(); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
    ellipse(ctx, 4, -61, 8, 10, '#fff', INK, 3); ellipse(ctx, 7, -61, 3, 4, '#2e2826');
    ellipse(ctx, -17, -35, 8, 5, '#ef7297');
    ctx.beginPath(); ctx.arc(14, -28, 15, .15, 1.3); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    line(ctx, [{ x: -40, y: 12 }, { x: -66, y: 0 }], INK, 5);
    line(ctx, [{ x: 40, y: 12 }, { x: 65, y: -2 }], INK, 5);
    if (options.muddy) {
      ellipse(ctx, -11, 23, 20, 11, '#8c5c42');
      ellipse(ctx, 22, -2, 10, 7, '#8c5c42');
    }
    ctx.restore();
  }

  function drawPuppy(ctx, x, y, scale = 1, options = {}) {
    const fur = options.fur || '#c58955';
    const uniform = options.uniform || '#2f8fd3';
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    line(ctx, [{ x: -16, y: 45 }, { x: -20, y: 79 }], INK, 6);
    line(ctx, [{ x: 16, y: 45 }, { x: 21, y: 79 }], INK, 6);
    roundedRect(ctx, -40, -5, 80, 62, 26); ctx.fillStyle = uniform; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ellipse(ctx, 0, -48, 43, 38, fur, INK, 5);
    ellipse(ctx, -39, -45, 17, 36, options.ear || '#805231', INK, 5);
    ellipse(ctx, 39, -45, 17, 36, options.ear || '#805231', INK, 5);
    ellipse(ctx, 0, -34, 23, 18, '#f2c59d', INK, 4);
    ellipse(ctx, 0, -46, 7, 6, '#2e2826');
    ellipse(ctx, -16, -60, 6, 8, '#fff', INK, 2); ellipse(ctx, 16, -60, 6, 8, '#fff', INK, 2);
    ellipse(ctx, -15, -60, 2.5, 4, '#2e2826'); ellipse(ctx, 15, -60, 2.5, 4, '#2e2826');
    roundedRect(ctx, -37, -92, 74, 25, 12); ctx.fillStyle = uniform; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -91); ctx.quadraticCurveTo(0, -119, 28, -91); ctx.closePath(); ctx.fillStyle = uniform; ctx.fill(); ctx.stroke();
    starPath(ctx, 0, 10, 12, 6); ctx.fillStyle = '#ffe05c'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function drawDragon(ctx, x, y, scale = 1, options = {}) {
    const body = options.body || '#73c950';
    const belly = options.belly || '#ffe18a';
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.beginPath(); ctx.moveTo(30, 36); ctx.quadraticCurveTo(77, 31, 73, 69); ctx.quadraticCurveTo(55, 51, 24, 60); ctx.closePath(); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ellipse(ctx, 0, 15, 43, 56, body, INK, 5);
    ellipse(ctx, 4, 23, 24, 36, belly);
    ellipse(ctx, 0, -48, 45, 38, body, INK, 5);
    ctx.beginPath(); ctx.moveTo(34, -56); ctx.quadraticCurveTo(74, -50, 58, -25); ctx.quadraticCurveTo(43, -19, 29, -31); ctx.closePath(); ctx.fillStyle = body; ctx.fill(); ctx.stroke();
    ellipse(ctx, 55, -42, 4, 5, '#2f2926');
    ellipse(ctx, -13, -57, 8, 11, '#fff', INK, 2); ellipse(ctx, 13, -57, 8, 11, '#fff', INK, 2);
    ellipse(ctx, -11, -56, 3, 5, '#292522'); ellipse(ctx, 15, -56, 3, 5, '#292522');
    for (let index = 0; index < 4; index += 1) {
      ctx.beginPath(); ctx.moveTo(-31 + index * 20, -81); ctx.lineTo(-20 + index * 20, -111); ctx.lineTo(-8 + index * 20, -79); ctx.closePath(); ctx.fillStyle = options.spikes || '#f08d4b'; ctx.fill(); ctx.stroke();
    }
    line(ctx, [{ x: -21, y: 60 }, { x: -22, y: 86 }, { x: -37, y: 88 }], INK, 6);
    line(ctx, [{ x: 20, y: 60 }, { x: 23, y: 86 }, { x: 39, y: 88 }], INK, 6);
    ctx.restore();
  }

  function drawHen(ctx, x, y, scale = 1, options = {}) {
    const direction = options.direction === -1 ? -1 : 1;
    const body = options.body || '#ffd92f';
    ctx.save(); ctx.translate(x, y); ctx.scale(direction * scale, scale);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ellipse(ctx, 0, 5, 71, 72, body, INK, 7);
    ctx.beginPath(); ctx.moveTo(-54, -21); ctx.quadraticCurveTo(-96, -60, -80, -4); ctx.quadraticCurveTo(-104, 25, -55, 24); ctx.closePath(); ctx.fillStyle = body; ctx.fill(); ctx.stroke();
    ellipse(ctx, 57, -25, 42, 38, body, INK, 7);
    ctx.beginPath(); ctx.moveTo(87, -29); ctx.lineTo(118, -15); ctx.lineTo(88, -3); ctx.closePath(); ctx.fillStyle = '#f59b28'; ctx.fill(); ctx.stroke();
    ellipse(ctx, 65, -34, 7, 9, '#fff', INK, 3); ellipse(ctx, 68, -33, 3, 4, '#27231f');
    ctx.beginPath(); ctx.moveTo(37, -60); ctx.bezierCurveTo(30, -92, 52, -98, 57, -70); ctx.bezierCurveTo(56, -103, 83, -100, 77, -64); ctx.bezierCurveTo(84, -86, 104, -75, 88, -51); ctx.closePath(); ctx.fillStyle = '#ef4b43'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(62, 7); ctx.bezierCurveTo(76, 24, 87, 11, 82, -3); ctx.bezierCurveTo(95, 14, 106, 4, 91, -17); ctx.closePath(); ctx.fillStyle = '#ef4b43'; ctx.fill(); ctx.stroke();
    line(ctx, [{ x: -22, y: 70 }, { x: -22, y: 100 }, { x: -37, y: 111 }], '#e18b28', 7);
    line(ctx, [{ x: 24, y: 70 }, { x: 24, y: 100 }, { x: 41, y: 111 }], '#e18b28', 7);
    ctx.restore();
  }

  function drawEgg(ctx, x, y, scale = 1, phase = 0, color = '#fff9e8') {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    if (phase < .48) {
      ctx.beginPath();
      ctx.moveTo(0, -38); ctx.bezierCurveTo(29, -34, 35, 20, 0, 34); ctx.bezierCurveTo(-35, 20, -29, -34, 0, -38); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
      if (phase > .12) {
        line(ctx, [{ x: -18, y: -4 }, { x: -5, y: -14 }, { x: 7, y: 2 }, { x: 19, y: -8 }], INK, 4);
      }
    } else {
      ctx.beginPath(); ctx.moveTo(-31, 3); ctx.lineTo(-18, -8); ctx.lineTo(-7, 4); ctx.lineTo(4, -11); ctx.lineTo(16, 3); ctx.lineTo(31, -7); ctx.lineTo(24, 28); ctx.quadraticCurveTo(0, 40, -24, 28); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    }
    ctx.restore();
  }

  function drawChick(ctx, x, y, scale = 1, options = {}) {
    const direction = options.direction === -1 ? -1 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(direction * scale, scale);
    ellipse(ctx, 0, 3, 31, 28, options.color || '#ffe54f', INK, 4);
    ellipse(ctx, 20, -18, 22, 21, options.color || '#ffe54f', INK, 4);
    ctx.beginPath(); ctx.moveTo(38, -19); ctx.lineTo(56, -12); ctx.lineTo(38, -6); ctx.closePath(); ctx.fillStyle = '#f39a27'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    ellipse(ctx, 24, -23, 4, 5, '#2c2825');
    line(ctx, [{ x: -8, y: 28 }, { x: -10, y: 42 }, { x: -20, y: 44 }], '#dd8c2a', 4);
    line(ctx, [{ x: 13, y: 28 }, { x: 15, y: 42 }, { x: 25, y: 44 }], '#dd8c2a', 4);
    ctx.restore();
  }

  function drawCoop(ctx, x, y, scale = 1, color = '#f2c735', options = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = '#9d6038'; ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-88, -34); ctx.lineTo(0, -112); ctx.lineTo(88, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
    roundedRect(ctx, -76, -38, 152, 128, 10); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    roundedRect(ctx, -31, 15, 62, 75, 25); ctx.fillStyle = '#49382e'; ctx.fill(); ctx.stroke();
    line(ctx, [{ x: -63, y: 94 }, { x: -73, y: 120 }], INK, 8);
    line(ctx, [{ x: 63, y: 94 }, { x: 73, y: 120 }], INK, 8);
    if (options.label) text(ctx, options.label, 0, -18, 22, { color: '#fff', stroke: INK, strokeWidth: 4 });
    ctx.restore();
  }

  function drawPuddle(ctx, x, y, scale = 1, amount = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale * (.65 + amount * .35), scale * (.65 + amount * .35));
    ctx.beginPath();
    ctx.moveTo(-84, 0); ctx.bezierCurveTo(-82, -31, -43, -40, -18, -24); ctx.bezierCurveTo(5, -48, 50, -34, 53, -15); ctx.bezierCurveTo(92, -5, 83, 27, 48, 29); ctx.bezierCurveTo(26, 48, -19, 39, -30, 25); ctx.bezierCurveTo(-66, 38, -100, 23, -84, 0); ctx.closePath();
    ctx.fillStyle = '#8a5a43'; ctx.fill(); ctx.strokeStyle = '#63402f'; ctx.lineWidth = 6; ctx.stroke();
    ellipse(ctx, -24, -5, 32, 10, 'rgba(189,137,92,.48)');
    ctx.restore();
  }

  function drawCounter(ctx, value, x = 54, y = 38) {
    roundedRect(ctx, x + 6, y + 7, 196, 100, 26); ctx.fillStyle = 'rgba(29,47,67,.25)'; ctx.fill();
    roundedRect(ctx, x, y, 196, 100, 26); ctx.fillStyle = '#384657'; ctx.fill(); ctx.strokeStyle = '#26313f'; ctx.lineWidth = 6; ctx.stroke();
    text(ctx, P.Utils.pad3(value), x + 98, y + 51, 68, { family: 'Arial, sans-serif', color: '#fff', weight: 900 });
  }

  function drawSeed(ctx, x, y, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.4); ellipse(ctx, 0, 0, 8 * scale, 4 * scale, '#f4cf57', '#8d6934', 2 * scale); ctx.restore();
  }

  function drawStartScene(ctx, time = 0) {
    drawLandscape(ctx, { sky: '#46b9ef', grass: '#80d16a', sunX: 1125, sunY: 96 });
    drawFence(ctx, 510, 'rgba(255,245,218,.9)');
    // Playful house and windmill create a unified storybook scene.
    roundedRect(ctx, 480, 315, 320, 230, 18); ctx.fillStyle = '#fff0c9'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(440, 330); ctx.lineTo(640, 190); ctx.lineTo(840, 330); ctx.closePath(); ctx.fillStyle = '#f26471'; ctx.fill(); ctx.stroke();
    roundedRect(ctx, 592, 411, 96, 134, 42); ctx.fillStyle = '#53a4dd'; ctx.fill(); ctx.stroke();
    roundedRect(ctx, 516, 354, 64, 64, 8); ctx.fillStyle = '#a9e3f7'; ctx.fill(); ctx.stroke();
    roundedRect(ctx, 704, 354, 64, 64, 8); ctx.fillStyle = '#a9e3f7'; ctx.fill(); ctx.stroke();
    const bob = Math.sin(time * 2) * 4;
    drawPig(ctx, 305, 551 - bob, .78, { outfit: '#4c91d2', skin: '#f3a0b9' });
    drawPig(ctx, 220, 557 + bob, .68, { outfit: '#f08c45', skin: '#f3a0b9' });
    drawPig(ctx, 128, 565 - bob, .57, { outfit: '#ed4f70' });
    drawPig(ctx, 55, 571 + bob, .47, { outfit: '#4c9bdd', skin: '#f6a9c0' });
    drawPuppy(ctx, 965, 555 + bob, .7, { uniform: '#328bd2', fur: '#ba7e4e' });
    drawPuppy(ctx, 1050, 560 - bob, .63, { uniform: '#e55156', fur: '#d2b27c', ear: '#7a563e' });
    drawPuppy(ctx, 1134, 566 + bob, .58, { uniform: '#58a85b', fur: '#9a6a4a' });
    drawDragon(ctx, 775, 567 + bob, .65, { body: '#65c751', spikes: '#f38b45' });
    drawDragon(ctx, 867, 570 - bob, .56, { body: '#59b5df', spikes: '#f7d354', belly: '#e4f4ff' });
    drawHen(ctx, 640, 565 + Math.sin(time * 3) * 3, .55);
  }

  function drawBackground(ctx, id, x = 0, y = 0, w = 1280, h = 720) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.translate(x, y); ctx.scale(w / 1280, h / 720);
    if (id === 0) {
      drawLandscape(ctx, { sky: '#58c1ee', grass: '#82d469' });
      drawFence(ctx, 530);
    } else if (id === 1) {
      ctx.fillStyle = '#f7c9d9'; ctx.fillRect(0, 0, 1280, 720);
      for (let i = 0; i < 18; i += 1) { starPath(ctx, 50 + i * 78, 70 + (i % 3) * 90, 13, 6); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill(); }
      ctx.fillStyle = '#d99468'; ctx.fillRect(0, 545, 1280, 175);
      roundedRect(ctx, 100, 318, 450, 250, 30); ctx.fillStyle = '#fff7df'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
      roundedRect(ctx, 125, 356, 400, 190, 24); ctx.fillStyle = '#88c9ed'; ctx.fill();
      roundedRect(ctx, 760, 210, 360, 350, 20); ctx.fillStyle = '#f4e1b2'; ctx.fill(); ctx.stroke();
    } else if (id === 2) {
      ctx.fillStyle = '#ffde72'; ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#64b8e8'; ctx.fillRect(0, 450, 1280, 270);
      for (let x2 = 0; x2 < 1280; x2 += 120) { for (let y2 = 450; y2 < 720; y2 += 90) { roundedRect(ctx, x2 + 6, y2 + 6, 108, 78, 16); ctx.fillStyle = (x2 / 120 + y2 / 90) % 2 ? '#75c8ef' : '#55a8db'; ctx.fill(); } }
      roundedRect(ctx, 135, 170, 320, 310, 18); ctx.fillStyle = '#f7efe0'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
      for (let shelf = 0; shelf < 3; shelf += 1) line(ctx, [{ x: 150, y: 260 + shelf * 90 }, { x: 440, y: 260 + shelf * 90 }], '#a46d48', 10);
      roundedRect(ctx, 760, 315, 360, 200, 28); ctx.fillStyle = '#f16e8b'; ctx.fill(); ctx.stroke();
    } else if (id === 3) {
      drawLandscape(ctx, { sky: '#7bcdf0', grass: '#73cc61', sunX: 1050, sunY: 90 });
      for (let i = 0; i < 12; i += 1) flower(ctx, 70 + i * 106, 520 + (i % 3) * 50, 26, ['#f07dac', '#fff', '#9c82d7'][i % 3]);
      roundedRect(ctx, 950, 320, 190, 195, 12); ctx.fillStyle = '#a6d8ef'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(915, 335); ctx.lineTo(1045, 230); ctx.lineTo(1175, 335); ctx.closePath(); ctx.fillStyle = '#76bfc9'; ctx.fill(); ctx.stroke();
    } else if (id === 4) {
      drawLandscape(ctx, { sky: '#73c8ef', grass: '#79cf62' });
      drawFence(ctx, 460);
      drawCoop(ctx, 910, 440, 1.3, '#f5c93d');
      ellipse(ctx, 360, 570, 280, 75, '#d8ad68');
    } else if (id === 5) {
      drawLandscape(ctx, { sky: '#9bcce1', grass: '#64b45c' });
      ctx.fillStyle = 'rgba(112,143,155,.18)'; ctx.fillRect(0, 0, 1280, 720);
      drawPuddle(ctx, 310, 550, 1.5, 1); drawPuddle(ctx, 820, 570, 1.25, .9); drawPuddle(ctx, 1080, 475, .75, .8);
      for (let i = 0; i < 14; i += 1) line(ctx, [{ x: 30 + i * 97, y: 80 }, { x: 10 + i * 97, y: 120 }], 'rgba(255,255,255,.55)', 4);
    } else if (id === 6) {
      drawLandscape(ctx, { sky: '#55bdeb', grass: '#75cd62' });
      ctx.fillStyle = '#d9b16c'; ctx.beginPath(); ctx.moveTo(0, 620); ctx.quadraticCurveTo(520, 430, 1280, 585); ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = '#8b5c39'; ctx.fillRect(120 + i * 255, 325, 30, 220);
        ellipse(ctx, 135 + i * 255, 310, 90, 100, ['#5eb95b', '#69c466'][i % 2]);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, 720); gradient.addColorStop(0, '#253875'); gradient.addColorStop(1, '#6d68a1'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
      ellipse(ctx, 1050, 110, 58, 58, '#fff3b0'); ellipse(ctx, 1025, 89, 56, 56, '#2b3d78');
      for (let i = 0; i < 40; i += 1) { starPath(ctx, 20 + (i * 97) % 1240, 30 + (i * 67) % 350, 4 + i % 4, 2); ctx.fillStyle = '#fff4a8'; ctx.fill(); }
      ctx.fillStyle = '#4d7b59'; ctx.beginPath(); ctx.moveTo(0, 485); ctx.quadraticCurveTo(320, 380, 620, 490); ctx.quadraticCurveTo(940, 365, 1280, 470); ctx.lineTo(1280, 720); ctx.lineTo(0, 720); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPuzzleScene(ctx, id, x = 0, y = 0, w = 800, h = 450) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y); ctx.scale(w / 1280, h / 720);
    if (id === 0) {
      ctx.fillStyle = '#35aeea'; ctx.fillRect(0, 0, 1280, 720);
      drawHen(ctx, 650, 330, 1.45);
      [[200,520],[360,570],[540,540],[760,570],[930,515],[1080,580]].forEach((point, index) => drawEgg(ctx, point[0], point[1], 1.2, index % 3 * .16));
      drawCounter(ctx, 6, 55, 40);
    } else if (id === 1) {
      drawBackground(ctx, 0);
      ctx.fillStyle = '#ef5f67'; ctx.beginPath(); ctx.moveTo(380, 510); ctx.lineTo(900, 510); ctx.lineTo(1040, 690); ctx.lineTo(240, 690); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 6; i += 1) { ctx.fillStyle = '#fff'; ctx.fillRect(290 + i * 130, 525, 55, 160); }
      drawPig(ctx, 390, 490, .9, { outfit: '#ed5171' }); drawPig(ctx, 890, 495, .75, { outfit: '#4c93d6' });
      drawChick(ctx, 640, 570, 1.15);
    } else if (id === 2) {
      drawBackground(ctx, 5);
      drawPuddle(ctx, 650, 575, 2.1, 1);
      drawPig(ctx, 570, 415, 1.1, { outfit: '#ed5171', muddy: true });
      drawPig(ctx, 790, 500, .8, { outfit: '#52a0dc', muddy: true });
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, 720); gradient.addColorStop(0, '#ffb46b'); gradient.addColorStop(1, '#f6e28b'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#74bf5b'; ctx.fillRect(0, 420, 1280, 300);
      drawCoop(ctx, 900, 420, 1.4, '#f2c735'); drawHen(ctx, 380, 420, 1.05);
      for (let i = 0; i < 5; i += 1) drawChick(ctx, 270 + i * 105, 600 + (i % 2) * 18, .7, { direction: i % 2 ? -1 : 1 });
    }
    ctx.restore();
  }

  const stickerKinds = ['pig', 'chick', 'hen', 'egg', 'star', 'heart', 'flower', 'cloud', 'sun', 'rainbow', 'tree', 'house', 'puddle', 'balloon', 'dragon'];
  const stickerPalettes = [
    ['#ef5d82', '#ffd45a'], ['#4b9dde', '#ffec80'], ['#71c85a', '#f59151']
  ];
  const stickers = Array.from({ length: 45 }, (_, id) => ({
    id,
    kind: stickerKinds[id % stickerKinds.length],
    color: stickerPalettes[Math.floor(id / stickerKinds.length)][0],
    accent: stickerPalettes[Math.floor(id / stickerKinds.length)][1]
  }));

  function drawSticker(ctx, stickerId, x, y, size = 90, rotation = 0) {
    const definition = stickers[stickerId] || stickers[0];
    const scale = size / 100;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
    ctx.shadowColor = 'rgba(47,41,40,.3)'; ctx.shadowBlur = 7 * scale; ctx.shadowOffsetY = 6 * scale;
    const kind = definition.kind;
    if (kind === 'pig') drawPig(ctx, 0, 12, .54 * scale, { outfit: definition.color });
    else if (kind === 'chick') drawChick(ctx, 0, 0, 1.15 * scale, { color: definition.accent });
    else if (kind === 'hen') drawHen(ctx, 0, 0, .58 * scale, { body: definition.accent });
    else if (kind === 'egg') drawEgg(ctx, 0, 0, 1.2 * scale, .1, definition.accent);
    else if (kind === 'star') { starPath(ctx, 0, 0, 46 * scale, 22 * scale); ctx.fillStyle = definition.accent; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5 * scale; ctx.stroke(); }
    else if (kind === 'heart') { heartPath(ctx, 0, 0, 58 * scale); ctx.fillStyle = definition.color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5 * scale; ctx.stroke(); }
    else if (kind === 'flower') flower(ctx, 0, 0, 75 * scale, definition.color, definition.accent);
    else if (kind === 'cloud') { cloud(ctx, 0, 0, .75 * scale, '#fff'); line(ctx, [{ x: -35 * scale, y: 28 * scale }, { x: -43 * scale, y: 48 * scale }], '#5faad6', 6 * scale); line(ctx, [{ x: 0, y: 30 * scale }, { x: -4 * scale, y: 54 * scale }], '#5faad6', 6 * scale); line(ctx, [{ x: 34 * scale, y: 28 * scale }, { x: 42 * scale, y: 48 * scale }], '#5faad6', 6 * scale); }
    else if (kind === 'sun') { ellipse(ctx, 0, 0, 33 * scale, 33 * scale, definition.accent, INK, 5 * scale); for (let i = 0; i < 12; i += 1) { const a = i * Math.PI / 6; line(ctx, [{ x: Math.cos(a) * 42 * scale, y: Math.sin(a) * 42 * scale }, { x: Math.cos(a) * 57 * scale, y: Math.sin(a) * 57 * scale }], definition.color, 7 * scale); } }
    else if (kind === 'rainbow') { ['#ed5a68','#f5a13d','#ffe15a','#70c660','#55a9df'].forEach((color, i) => { ctx.beginPath(); ctx.arc(0, 30 * scale, (58 - i * 9) * scale, Math.PI, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 10 * scale; ctx.stroke(); }); cloud(ctx, -53 * scale, 31 * scale, .35 * scale); cloud(ctx, 53 * scale, 31 * scale, .35 * scale); }
    else if (kind === 'tree') { roundedRect(ctx, -12 * scale, 8 * scale, 24 * scale, 58 * scale, 7 * scale); ctx.fillStyle = '#925f38'; ctx.fill(); ellipse(ctx, 0, -12 * scale, 43 * scale, 48 * scale, definition.color, INK, 5 * scale); }
    else if (kind === 'house') { roundedRect(ctx, -42 * scale, -8 * scale, 84 * scale, 65 * scale, 6 * scale); ctx.fillStyle = definition.accent; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5 * scale; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-55 * scale, -7 * scale); ctx.lineTo(0, -55 * scale); ctx.lineTo(55 * scale, -7 * scale); ctx.closePath(); ctx.fillStyle = definition.color; ctx.fill(); ctx.stroke(); roundedRect(ctx, -13 * scale, 20 * scale, 26 * scale, 37 * scale, 10 * scale); ctx.fillStyle = '#59a7db'; ctx.fill(); ctx.stroke(); }
    else if (kind === 'puddle') { drawPuddle(ctx, 0, 5 * scale, .65 * scale, 1); ellipse(ctx, -18 * scale, -2 * scale, 8 * scale, 6 * scale, definition.accent); ellipse(ctx, 18 * scale, 8 * scale, 6 * scale, 4 * scale, definition.accent); }
    else if (kind === 'balloon') { ellipse(ctx, 0, -18 * scale, 34 * scale, 43 * scale, definition.color, INK, 5 * scale); ctx.beginPath(); ctx.moveTo(-6 * scale, 25 * scale); ctx.lineTo(0, 35 * scale); ctx.lineTo(6 * scale, 25 * scale); ctx.closePath(); ctx.fillStyle = definition.color; ctx.fill(); ctx.stroke(); line(ctx, [{ x: 0, y: 35 * scale }, { x: 10 * scale, y: 68 * scale }, { x: -4 * scale, y: 86 * scale }], INK, 3 * scale); }
    else drawDragon(ctx, 0, 6, .55 * scale, { body: definition.color, spikes: definition.accent });
    ctx.restore();
  }

  Art.INK = INK;
  Art.roundedRect = roundedRect;
  Art.ellipse = ellipse;
  Art.line = line;
  Art.text = text;
  Art.starPath = starPath;
  Art.heartPath = heartPath;
  Art.cloud = cloud;
  Art.flower = flower;
  Art.drawButton = drawButton;
  Art.drawCard = drawCard;
  Art.drawBluePattern = drawBluePattern;
  Art.drawLandscape = drawLandscape;
  Art.drawFence = drawFence;
  Art.drawPig = drawPig;
  Art.drawPuppy = drawPuppy;
  Art.drawDragon = drawDragon;
  Art.drawHen = drawHen;
  Art.drawEgg = drawEgg;
  Art.drawChick = drawChick;
  Art.drawCoop = drawCoop;
  Art.drawPuddle = drawPuddle;
  Art.drawCounter = drawCounter;
  Art.drawSeed = drawSeed;
  Art.drawStartScene = drawStartScene;
  Art.drawBackground = drawBackground;
  Art.drawPuzzleScene = drawPuzzleScene;
  Art.drawSticker = drawSticker;
  Art.stickers = stickers;
})(window);
