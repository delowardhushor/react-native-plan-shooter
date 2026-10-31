import React from 'react';
import { Canvas, Circle, Group, Picture, RadialGradient, vec, type SkPicture } from '@shopify/react-native-skia';

const DEFAULT_W = 160;
const DEFAULT_H = 60;

// Sprite on a soft glow in the item's colour
export const SpriteIcon = ({ picture, width, height, scale, color, dim, boxWidth = DEFAULT_W, boxHeight = DEFAULT_H }: {
  picture: SkPicture; width: number; height: number; scale: number; color: string; dim?: boolean;
  boxWidth?: number; boxHeight?: number;
}) => (
  <Canvas style={{ width: boxWidth, height: boxHeight, opacity: dim ? 0.45 : 1 }}>
    <Circle cx={boxWidth / 2} cy={boxHeight / 2} r={boxHeight / 2}>
      <RadialGradient c={vec(boxWidth / 2, boxHeight / 2)} r={boxHeight / 2} colors={[`${color}77`, `${color}00`]} />
    </Circle>
    <Group transform={[{ translateX: (boxWidth - width * scale) / 2 }, { translateY: (boxHeight - height * scale) / 2 }, { scale }]}>
      <Picture picture={picture} />
    </Group>
  </Canvas>
);
