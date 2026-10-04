import {
  Skia, TileMode, PaintStyle, createPicture,
  type SkCanvas, type SkImage, type SkPaint, type SkPicture, type SkShader, type SkPath,
} from '@shopify/react-native-skia';

export const fillPaint = (color: string): SkPaint => {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  return p;
};

export const strokePaint = (color: string, width: number): SkPaint => {
  const p = fillPaint(color);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  return p;
};

export const shaderPaint = (shader: SkShader): SkPaint => {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setShader(shader);
  return p;
};

export const linear = (
  x0: number, y0: number, x1: number, y1: number, colors: string[], pos?: number[]
): SkShader =>
  Skia.Shader.MakeLinearGradient(
    { x: x0, y: y0 }, { x: x1, y: y1 }, colors.map(c => Skia.Color(c)), pos ?? null, TileMode.Clamp
  );

export const radial = (cx: number, cy: number, r: number, colors: string[], pos?: number[]): SkShader =>
  Skia.Shader.MakeRadialGradient({ x: cx, y: cy }, r, colors.map(c => Skia.Color(c)), pos ?? null, TileMode.Clamp);

export const poly = (pts: number[][], close = true): SkPath => {
  const path = Skia.PathBuilder.Make();
  pts.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  if (close) path.close();
  return path.build();
};

export const record = (width: number, height: number, draw: (c: SkCanvas) => void): SkPicture =>
  createPicture(draw, { width, height });

export const createPictureUnbounded = (draw: (c: SkCanvas) => void): SkPicture => createPicture(draw);

// Rasterise once so expensive effects (blurs) are paid a single time instead of every frame
export const bake = (width: number, height: number, draw: (c: SkCanvas) => void): SkImage => {
  const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Unable to create offscreen surface');
  draw(surface.getCanvas());
  surface.flush();
  return surface.makeImageSnapshot();
};

export const rect = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);

// Deterministic pseudo-random so tiled layers look organic but identical between launches
export const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};
