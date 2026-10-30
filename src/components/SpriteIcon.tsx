import React from 'react';
import { Canvas, Circle, Group, Picture, RadialGradient, vec, type SkPicture } from '@shopify/react-native-skia';

const ICON_W = 160;
const ICON_H = 60;

// Sprite on a soft glow in the item's colour
export const SpriteIcon = ({ picture, width, height, scale, color, dim }: {
  picture: SkPicture; width: number; height: number; scale: number; color: string; dim?: boolean;
}) => (
  <Canvas style={{ width: ICON_W, height: ICON_H, opacity: dim ? 0.45 : 1 }}>
    <Circle cx={ICON_W / 2} cy={ICON_H / 2} r={ICON_H / 2}>
      <RadialGradient c={vec(ICON_W / 2, ICON_H / 2)} r={ICON_H / 2} colors={[`${color}77`, `${color}00`]} />
    </Circle>
    <Group transform={[{ translateX: (ICON_W - width * scale) / 2 }, { translateY: (ICON_H - height * scale) / 2 }, { scale }]}>
      <Picture picture={picture} />
    </Group>
  </Canvas>
);
