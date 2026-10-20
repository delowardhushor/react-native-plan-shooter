// Minimal Skia -> Canvas2D shim so the game's sprite code runs unchanged in a browser.
const EnemyType = new Proxy({}, { get: (_, k) => k });
const BlurStyle = { Normal: 0 };
const mk = (fn) => ({ fn });
const addStops = (g, colors, pos) => { colors.forEach((col, i) => g.addColorStop(pos ? pos[i] : i / (colors.length - 1), col)); return g; };
const linear = (x0, y0, x1, y1, colors, pos) => mk(ctx => addStops(ctx.createLinearGradient(x0, y0, x1, y1), colors, pos));
const radial = (cx, cy, r, colors, pos) => mk(ctx => addStops(ctx.createRadialGradient(cx, cy, 0, cx, cy, r), colors, pos));
const fillPaint = (color) => ({ fill: color });
const strokePaint = (color, width) => ({ stroke: color, width });
const shaderPaint = (shader) => ({ fill: shader });
const poly = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const Skia = {
  PathBuilder: { Make: () => { const p = new Path2D(); const b = {
    moveTo: (x, y) => (p.moveTo(x, y), b), lineTo: (x, y) => (p.lineTo(x, y), b),
    cubicTo: (...a) => (p.bezierCurveTo(...a), b), quadTo: (...a) => (p.quadraticCurveTo(...a), b),
    close: () => (p.closePath(), b), build: () => p }; return b; } },
  XYWHRect: (x, y, w, h) => ({ x, y, w, h }),
  RRectXY: (r, rx, ry) => ({ ...r, rx, ry }),
  Paint: () => ({ setColor() {}, setMaskFilter() {} }),
  Color: (c) => c,
  MaskFilter: { MakeBlur: () => null },
};
const resolve = (ctx, v) => (v && v.fn ? v.fn(ctx) : v);
const wrap = (ctx) => {
  const paintIt = (paint, fillFn, strokeFn) => {
    if (paint.stroke) { ctx.strokeStyle = resolve(ctx, paint.stroke); ctx.lineWidth = paint.width; strokeFn(); }
    else { ctx.fillStyle = resolve(ctx, paint.fill); fillFn(); }
  };
  const rrPath = (r) => { const p = new Path2D(); p.roundRect(r.x, r.y, r.w, r.h, Math.min(r.rx, r.h / 2)); return p; };
  return {
    drawPath: (p, paint) => paintIt(paint, () => ctx.fill(p), () => ctx.stroke(p)),
    drawLine: (x0, y0, x1, y1, paint) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); paintIt(paint, () => {}, () => ctx.stroke()); },
    drawCircle: (x, y, r, paint) => { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); paintIt(paint, () => ctx.fill(p), () => ctx.stroke(p)); },
    drawOval: (r, paint) => { const p = new Path2D(); p.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); paintIt(paint, () => ctx.fill(p), () => ctx.stroke(p)); },
    drawRect: (r, paint) => paintIt(paint, () => ctx.fillRect(r.x, r.y, r.w, r.h), () => ctx.strokeRect(r.x, r.y, r.w, r.h)),
    drawRRect: (r, paint) => { const p = rrPath(r); paintIt(paint, () => ctx.fill(p), () => ctx.stroke(p)); },
  };
};
