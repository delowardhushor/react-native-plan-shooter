const W = 1000, H = 500;
const cv = document.getElementById('cv'); const ctx = cv.getContext('2d'); const c = wrap(ctx);
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646); })();

// ---- sky (same ramp as the in-game backdrop) ----
let g = ctx.createLinearGradient(0, 0, 0, H);
[['#0f4a95', 0], ['#2f7cc6', .38], ['#7fbbe8', .72], ['#dcecf3', 1]].forEach(([col, p]) => g.addColorStop(p, col));
ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

// sun glow behind the action
const sx = 700, sy = 215;
g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 330);
g.addColorStop(0, 'rgba(255,244,205,0.95)'); g.addColorStop(.3, 'rgba(255,230,170,0.4)'); g.addColorStop(1, 'rgba(255,220,150,0)');
ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#fffdf2'; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill();

// sun rays
ctx.save(); ctx.translate(sx, sy); ctx.globalCompositeOperation = 'screen';
for (let i = 0; i < 14; i++) {
  ctx.rotate((Math.PI * 2) / 14);
  const rg = ctx.createLinearGradient(0, 0, 520, 0); rg.addColorStop(0, 'rgba(255,240,190,0.16)'); rg.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(520, -34); ctx.lineTo(520, 34); ctx.lineTo(0, 5); ctx.fill();
}
ctx.restore();

const cloud = (cx, cy, s, a) => {
  for (let i = 0; i < 8; i++) {
    const u = i / 7, lift = Math.sin(u * Math.PI);
    const px = cx + (u - .5) * s * 3.2 + (rnd() - .5) * s * .2, py = cy - lift * s * .35 + (rnd() - .5) * s * .15;
    const pr = s * (.5 + lift * .55) * (.85 + rnd() * .3);
    let sh = ctx.createRadialGradient(px, py + pr * .28, 0, px, py + pr * .28, pr);
    sh.addColorStop(0, `rgba(140,160,190,${a * .5})`); sh.addColorStop(.55, `rgba(140,160,190,${a * .3})`); sh.addColorStop(1, 'rgba(140,160,190,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(px, py + pr * .28, pr, 0, 7); ctx.fill();
    let wh = ctx.createRadialGradient(px, py - pr * .08, 0, px, py - pr * .08, pr);
    wh.addColorStop(0, `rgba(255,255,255,${a})`); wh.addColorStop(.55, `rgba(255,255,255,${a * .8})`); wh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wh; ctx.beginPath(); ctx.arc(px, py - pr * .08, pr, 0, 7); ctx.fill();
  }
};
const ridge = (base, amp, hs, cols, rim, top) => {
  const p = new Path2D(); p.moveTo(0, H);
  for (let x = 0; x <= W; x += 5) { const v = hs.reduce((a, [k, w, ph]) => a + w * (1 - Math.abs(Math.sin(2 * Math.PI * k * x / W + ph))), 0) / hs.reduce((a, h) => a + h[1], 0); p.lineTo(x, base - amp * v); }
  p.lineTo(W, H); p.closePath();
  const lg = ctx.createLinearGradient(0, top, 0, H); lg.addColorStop(0, cols[0]); lg.addColorStop(1, cols[1]);
  ctx.fillStyle = lg; ctx.fill(p); ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke(p);
};
// far clouds
[[120, 90, 34, .55], [430, 60, 28, .5], [880, 120, 40, .5], [250, 190, 30, .4]].forEach(a => cloud(...a));
ridge(470, 130, [[2, 1, .4], [5, .6, 1.3], [9, .3, 2.2]], ['#8fa8c4', '#bcd2e4'], 'rgba(255,255,255,0.35)', 330);
ridge(490, 100, [[3, 1, 2.1], [7, .5, .7], [12, .25, 3]], ['#5f819f', '#9ebbd0'], 'rgba(255,255,255,0.25)', 400);
// haze at the base
g = ctx.createLinearGradient(0, 360, 0, H); g.addColorStop(0, 'rgba(226,240,248,0)'); g.addColorStop(1, 'rgba(226,240,248,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 360, W, 140);
// foreground cloud bank
[[80, 468, 46, .9], [330, 488, 52, .95], [620, 478, 50, .9], [900, 490, 56, .95]].forEach(a => cloud(...a));

// ---- helpers ----
const sprite = (draw, pal, frame, x, y, scale, { flip = false, rot = 0, extra } = {}) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, scale); ctx.translate(-frame.width / 2, -frame.height / 2);
  ctx.shadowColor = 'rgba(0,10,30,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 14;
  draw(c, pal, extra);
  ctx.restore();
};
const glow = (x, y, r, inner, mid) => {
  const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(.18, inner); rg.addColorStop(.5, mid); rg.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
};
const trail = (x, y, len, thick, rot) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
  const tg = ctx.createLinearGradient(0, 0, -len, 0); tg.addColorStop(0, 'rgba(255,255,255,0.55)'); tg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(0, -thick * .4); ctx.lineTo(-len, -thick * 1.8); ctx.lineTo(-len, thick * 1.8); ctx.lineTo(0, thick * .4); ctx.fill();
  ctx.restore();
};
const bullet = (x, y, len, rot = 0) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
  ctx.shadowColor = '#ffc933'; ctx.shadowBlur = 16;
  const bg = ctx.createLinearGradient(-len, 0, 0, 0); bg.addColorStop(0, 'rgba(255,210,80,0)'); bg.addColorStop(.55, '#fff3b0'); bg.addColorStop(1, '#fff');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-len, -4, len, 8, 4); ctx.fill(); ctx.restore();
};
const fireball = (x, y, r) => {
  const ramp = [['#fffbe3', 1], ['#ffe27d', .95], ['#ffb12f', .85], ['#ff7418', .6], ['#d63a12', 0.0]];
  glow(x, y, r * 1.9, 'rgba(255,200,90,0.8)', 'rgba(255,110,30,0.35)');
  for (let i = 0; i < 16; i++) { const a = rnd() * 7, d = rnd() * r * .7, rr = r * (.25 + rnd() * .3);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const fg = ctx.createRadialGradient(px, py, 0, px, py, rr); const k = Math.min(4, Math.floor(d / (r * .7) * 4.6));
    fg.addColorStop(0, ramp[k][0]); fg.addColorStop(.55, ramp[k][0]); fg.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.globalAlpha = .9; ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  glow(x, y, r * .55, 'rgba(255,248,210,1)', 'rgba(255,200,90,0.6)');
};
const smoke = (x, y, r) => { for (let i = 0; i < 9; i++) { const px = x - i * r * .55, py = y - i * r * .08 + (rnd() - .5) * r * .5, rr = r * (.35 + i * .09);
  const sg = ctx.createRadialGradient(px, py, 0, px, py, rr); sg.addColorStop(0, `rgba(70,70,76,${.5 - i * .04})`); sg.addColorStop(1, 'rgba(70,70,76,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fill(); } };

// ---- ACTION ----
// enemy planes (mirrored, flying left toward the player)
const fx = { ENEMY: ENEMY_PALETTE };
// distant small enemies
sprite(drawJet, WAVER_PALETTE, JET_FRAME, 610, 105, 1.45, { flip: true, rot: 4 });
sprite(drawDelta, RUSHER_PALETTE, DELTA_FRAME, 880, 410, 2.2, { flip: true, rot: -5, extra: false });
// bomber
sprite(drawBomber, BOMBER_PALETTE, BOMBER_FRAME, 640, 400, 1.9, { flip: true, rot: -3, extra: false });
// titan boss, big on the right, glowing reactor
smoke(930, 120, 20);
sprite(drawTitan, TITAN_PALETTE, TITAN_FRAME, 800, 210, 3.5, { flip: true, rot: 2 });

// explosions
fireball(556, 388, 36);
fireball(560, 122, 24);

// player: hero jet, tilted up, with engine glow + tracer fire
const px = 285, py = 352, ps = 5.2, prot = -9;
trail(px - 145, py + 14, 260, 5, prot);
sprite(drawHeroSprite, FALCON_PALETTE, JET_FRAME, px, py, ps, { rot: prot, extra: 5 });
// engine flame
ctx.save(); ctx.translate(px, py); ctx.rotate(prot * Math.PI / 180);
glow(-140, 2, 56, 'rgba(150,210,255,0.8)', 'rgba(255,150,50,0.4)'); ctx.restore();
// tracers streaming to the right
[[500, 322, 70, -10], [585, 306, 90, -10], [670, 291, 70, -10], [740, 278, 60, -10]].forEach(b => bullet(...b));
// missiles
ctx.save(); ctx.translate(500, 408); ctx.rotate(-8 * Math.PI / 180); ctx.scale(2.6, 2.6); ctx.translate(-14, -4); drawHomingMissile(c); ctx.restore();
trail(475, 413, 170, 3, -8);
ctx.save(); ctx.translate(420, 440); ctx.rotate(-8 * Math.PI / 180); ctx.scale(2.6, 2.6); ctx.translate(-14, -4); drawHomingMissile(c); ctx.restore();

// ---- vignette ----
g = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 650);
g.addColorStop(0, 'rgba(4,12,24,0)'); g.addColorStop(1, 'rgba(4,12,24,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

// ---- title ----
const title = (txt, x, y, size, spacing) => {
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = spacing + 'px';
  ctx.save(); ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,10,30,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.strokeStyle = '#0b2a52'; ctx.lineWidth = size * .22; ctx.strokeText(txt, x, y);
  ctx.restore();
  const tg = ctx.createLinearGradient(0, y - size * .75, 0, y); tg.addColorStop(0, '#ffffff'); tg.addColorStop(.55, '#f1f6fb'); tg.addColorStop(1, '#a9c4e0');
  ctx.fillStyle = tg; ctx.fillText(txt, x, y);
};
title('PLANE', 48, 112, 92, 6);
title('SHOOTER', 48, 208, 92, 6);
// tagline
ctx.font = '900 25px "Arial Black", Arial, sans-serif'; ctx.letterSpacing = '12px';
ctx.fillStyle = '#ffb23e'; ctx.shadowColor = 'rgba(0,10,30,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
ctx.fillText('DEFEND THE SKIES', 52, 250); ctx.shadowColor = 'transparent';
document.title = 'ready';
