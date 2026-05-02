import React, { useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { COLOR_FG } from '../engine/Constants';

interface ControlsOverlayProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onMissileFire: () => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ onDirectionChange, onMissileFire }) => {
  const centerRef = useRef({ x: 0, y: 0 });
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        centerRef.current = { x: gestureState.x0, y: gestureState.y0 };
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentX = gestureState.moveX;
        const currentY = gestureState.moveY;
        
        let diffX = currentX - centerRef.current.x;
        let diffY = currentY - centerRef.current.y;
        
        const maxDist = 45; 
        const dist = Math.sqrt(diffX * diffX + diffY * diffY);
        
        // Floating joystick: if dragging beyond the max radius, pull the center point along
        if (dist > maxDist) {
          const ratio = maxDist / dist;
          centerRef.current.x = currentX - diffX * ratio;
          centerRef.current.y = currentY - diffY * ratio;
          
          diffX = currentX - centerRef.current.x;
          diffY = currentY - centerRef.current.y;
        }
        
        // Generate smooth analog signals between -1.0 and 1.0 (true 360-degree control)
        let dx = diffX / maxDist;
        let dy = diffY / maxDist;
        
        // Small deadzone to make it easy to fully stop without lifting your finger
        if (Math.abs(dx) < 0.15) dx = 0;
        if (Math.abs(dy) < 0.15) dy = 0;
        
        // Cancel the previous stop instruction if finger is still moving
        if (stopTimer.current) clearTimeout(stopTimer.current);
        
        onDirectionChange(dx, dy);
        
        // If the finger stops moving for 100ms, automatically stop the plane 
        // and reset the joystick center point to exactly under the finger.
        stopTimer.current = setTimeout(() => {
          centerRef.current = { x: currentX, y: currentY };
          onDirectionChange(0, 0);
        }, 100);
      },
      onPanResponderRelease: () => {
        if (stopTimer.current) clearTimeout(stopTimer.current);
        onDirectionChange(0, 0);
      },
      onPanResponderTerminate: () => {
        if (stopTimer.current) clearTimeout(stopTimer.current);
        onDirectionChange(0, 0);
      }
    })
  ).current;

  return (
    <View style={styles.container} pointerEvents="box-none">
      
      {/* PanResponder maps swiping gestures across the entire left half of the screen */}
      <View style={styles.leftHalf} {...panResponder.panHandlers} />
      
      <View style={styles.rightHalf} pointerEvents="box-none">
        <TouchableOpacity onPress={onMissileFire} style={styles.missileBtn} activeOpacity={0.6}>
          <Text style={styles.btnText}>MISSILE</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill, 
    flexDirection: 'row',
    zIndex: 10,
    elevation: 10,
  },
  leftHalf: {
    flex: 1, 
    backgroundColor: 'transparent',
  },
  rightHalf: {
    flex: 1, 
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 30,
    pointerEvents: 'box-none',
  },
  missileBtn: {
    width: 100,
    height: 60,
    backgroundColor: 'rgba(90, 20, 20, 0.4)', 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3a1111',
  },
  btnText: {
    color: COLOR_FG,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  }
});
