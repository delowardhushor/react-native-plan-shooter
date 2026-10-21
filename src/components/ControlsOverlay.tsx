import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, type GestureResponderEvent } from 'react-native';
import { COLOR_TEXT, COLOR_PANEL_BORDER } from '../engine/Constants';

interface ControlsOverlayProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onMissileFire: () => void;
  missileCharge: number; // 0..1
  missileLabel: string;
  missileColor: string;
}

const MAX_DIST = 45;

// Raw touch events (not PanResponder/Touchable) are used on purpose: React Native's responder system
// grants only ONE active responder, so a held movement finger would block the missile button.
// Raw events are delivered per-finger, so steering and firing work at the same time.
export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({
  onDirectionChange, onMissileFire, missileCharge, missileLabel, missileColor,
}) => {
  const moveId = useRef<string | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [firing, setFiring] = useState(false);

  const clearStop = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  };

  const endMove = () => {
    moveId.current = null;
    clearStop();
    onDirectionChange(0, 0);
  };

  const dragTo = (currentX: number, currentY: number) => {
    let diffX = currentX - centerRef.current.x;
    let diffY = currentY - centerRef.current.y;
    const dist = Math.sqrt(diffX * diffX + diffY * diffY);

    // Floating joystick: if dragging beyond the max radius, pull the center point along
    if (dist > MAX_DIST) {
      const ratio = MAX_DIST / dist;
      centerRef.current.x = currentX - diffX * ratio;
      centerRef.current.y = currentY - diffY * ratio;
      diffX = currentX - centerRef.current.x;
      diffY = currentY - centerRef.current.y;
    }

    // Smooth analog signals between -1.0 and 1.0 (true 360-degree control)
    let dx = diffX / MAX_DIST;
    let dy = diffY / MAX_DIST;

    // Small deadzone to make it easy to fully stop without lifting your finger
    if (Math.abs(dx) < 0.15) dx = 0;
    if (Math.abs(dy) < 0.15) dy = 0;

    onDirectionChange(dx, dy);

    // If the finger stops moving for 100ms, stop the plane and re-center the joystick under the finger
    clearStop();
    stopTimer.current = setTimeout(() => {
      centerRef.current = { x: currentX, y: currentY };
      onDirectionChange(0, 0);
    }, 100);
  };

  const onSurfaceStart = (e: GestureResponderEvent) => {
    if (moveId.current !== null) return;
    const t = e.nativeEvent.changedTouches[0];
    moveId.current = String(t.identifier);
    centerRef.current = { x: t.pageX, y: t.pageY };
  };

  const onSurfaceMove = (e: GestureResponderEvent) => {
    const t = Array.from(e.nativeEvent.changedTouches).find(ct => String(ct.identifier) === moveId.current);
    if (t) dragTo(t.pageX, t.pageY);
  };

  const onSurfaceEnd = (e: GestureResponderEvent) => {
    if (Array.from(e.nativeEvent.changedTouches).some(ct => String(ct.identifier) === moveId.current)) endMove();
  };

  const ready = missileCharge >= 1;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* The whole screen steers the plane, left or right side alike */}
      <View
        style={StyleSheet.absoluteFill}
        onTouchStart={onSurfaceStart}
        onTouchMove={onSurfaceMove}
        onTouchEnd={onSurfaceEnd}
        onTouchCancel={onSurfaceEnd}
      />

      {/* Sibling of the surface, so its touches never start a movement drag */}
      <View
        style={styles.fireZone}
        onTouchStart={() => { setFiring(true); onMissileFire(); }}
        onTouchEnd={() => setFiring(false)}
        onTouchCancel={() => setFiring(false)}
      >
        <View
          style={[
            styles.missileBtn,
            { borderColor: ready || firing ? missileColor : COLOR_PANEL_BORDER, shadowColor: missileColor },
            firing && styles.missilePressed,
          ]}
          pointerEvents="none"
        >
          {/* Dark cover shrinks as the missile reloads */}
          <View style={[styles.cooldown, { height: `${(1 - missileCharge) * 100}%` }]} />
          <Text style={styles.btnText}>{missileLabel}</Text>
          <Text style={styles.btnSub}>{ready ? 'READY' : 'RELOAD'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    elevation: 10,
  },
  // Padded beyond the visible button so a thumb that lands near it still fires
  fireZone: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    padding: 16,
  },
  missilePressed: {
    transform: [{ scale: 0.93 }],
  },
  missileBtn: {
    width: 84,
    height: 84,
    backgroundColor: 'rgba(14, 26, 40, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 42,
    borderWidth: 2,
    borderColor: COLOR_PANEL_BORDER,
    shadowColor: '#ff3b2a',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  cooldown: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  btnText: {
    color: COLOR_TEXT,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  btnSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  }
});
