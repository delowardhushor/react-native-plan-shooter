import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { renderMenuFrame } from '../render/Renderer';

// Animated sky + cruising jet shown behind the menu screens
export const MenuBackdrop = () => {
  const frame = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const loop = () => {
      const now = Date.now();
      // Menu scrolls at half speed so text stays easy to read
      if (now - last.current >= 1000 / 40) {
        last.current = now;
        frame.current += 1;
        setTick(t => t + 1);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={renderMenuFrame(frame.current)} />
    </Canvas>
  );
};
