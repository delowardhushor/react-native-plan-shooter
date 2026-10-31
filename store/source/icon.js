const N = 512;
const shape = new URLSearchParams(location.search).get('shape') || 'square';
const cv = document.getElementById('cv'); const ctx = cv.getContext('2d'); const c = wrap(ctx);
const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647, (s - 1) / 2147483646); })();
ctx.clearRect(0, 0, N, N);
ctx.save();
const clip = new Path2D();
if (shape === 'round') clip.arc(N / 2, N / 2, N / 2, 0, 7);
else if (shape === 'rounded') clip.roundRect(0, 0, N, N, 112);
else clip.rect(0, 0, N, N);
ctx.clip(clip);

// sky
let g = ctx.createLinearGradient(0, 0, 0, N);
[['#0c4290', 0], ['#2b78c4', .45], ['#7fbbe8', .8], ['#dcecf3', 1]].forEach(([col, p]) => g.addColorStop(p, col));
ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
const sx = 370, sy = 150;
g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 330);
g.addColorStop(0, 'rgba(255,244,205,0.95)'); g.addColorStop(.3, 'rgba(255,230,170,0.4)'); g.addColorStop(1, 'rgba(255,220,150,0)');
ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
ctx.save(); ctx.translate(sx, sy); ctx.globalCompositeOperation = 'screen';
for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6);
  const rg = ctx.createLinearGradient(0, 0, 420, 0); rg.addColorStop(0, 'rgba(255,240,190,0.2)'); rg.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(420, -36); ctx.lineTo(420, 36); ctx.lineTo(0, 6); ctx.fill(); }
ctx.restore();

const cloud = (cx, cy, s, a) => { for (let i = 0; i < 8; i++) {
  const u = i / 7, lift = Math.sin(u * Math.PI);
  const px = cx + (u - .5) * s * 3.2 + (rnd() - .5) * s * .2, py = cy - lift * s * .35 + (rnd() - .5) * s * .15;
  const pr = s * (.5 + lift * .55) * (.85 + rnd() * .3);
  let sh = ctx.createRadialGradient(px, py + pr * .28, 0, px, py + pr * .28, pr);
  sh.addColorStop(0, `rgba(140,160,190,${a * .5})`); sh.addColorStop(.55, `rgba(140,160,190,${a * .3})`); sh.addColorStop(1, 'rgba(140,160,190,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(px, py + pr * .28, pr, 0, 7); ctx.fill();
  let wh = ctx.createRadialGradient(px, py - pr * .08, 0, px, py - pr * .08, pr);
  wh.addColorStop(0, `rgba(255,255,255,${a})`); wh.addColorStop(.55, `rgba(255,255,255,${a * .8})`); wh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wh; ctx.beginPath(); ctx.arc(px, py - pr * .08, pr, 0, 7); ctx.fill(); } };
cloud(110, 130, 34, .5);
cloud(60, 500, 62, .95); cloud(250, 520, 70, .95); cloud(450, 505, 66, .95);

// jet climbing up-right with exhaust trail
const rot = -24, jx = 256, jy = 262, sc = 8.2;
ctx.save(); ctx.translate(jx, jy); ctx.rotate(rot * Math.PI / 180);
const tg = ctx.createLinearGradient(-190, 0, -240, 0);
const tl = ctx.createLinearGradient(0, 0, -330, 0); tl.addColorStop(0, 'rgba(255,255,255,0.6)'); tl.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = tl; ctx.beginPath(); ctx.moveTo(-200, -6); ctx.lineTo(-420, -34); ctx.lineTo(-420, 34); ctx.lineTo(-200, 8); ctx.fill();
ctx.restore();
ctx.save(); ctx.translate(jx, jy); ctx.rotate(rot * Math.PI / 180);
ctx.shadowColor = 'rgba(0,10,30,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
ctx.scale(sc, sc); ctx.translate(-28, -13); drawHero(c, 5, FALCON_PALETTE);
ctx.restore();
ctx.save(); ctx.translate(jx, jy); ctx.rotate(rot * Math.PI / 180);
const eg = ctx.createRadialGradient(-218, 8, 0, -218, 8, 70);
eg.addColorStop(0, 'rgba(255,255,255,0.95)'); eg.addColorStop(.18, 'rgba(150,210,255,0.8)'); eg.addColorStop(.5, 'rgba(255,150,50,0.4)'); eg.addColorStop(1, 'rgba(255,100,20,0)');
ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(-218, 8, 70, 0, 7); ctx.fill(); ctx.restore();
// tracers ahead of the nose
const tracer = (x, y, len) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.shadowColor = '#ffc933'; ctx.shadowBlur = 14;
  const bg = ctx.createLinearGradient(-len, 0, 0, 0); bg.addColorStop(0, 'rgba(255,210,80,0)'); bg.addColorStop(.55, '#fff3b0'); bg.addColorStop(1, '#fff');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-len, -5, len, 10, 5); ctx.fill(); ctx.restore(); };
tracer(392, 120, 70); tracer(458, 66, 56);
ctx.restore();
document.title = 'ready';
