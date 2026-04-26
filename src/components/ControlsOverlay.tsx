import React, { useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, PanResponder } from 'react-native';
import { COLOR_FG } from '../engine/Constants';

interface ControlsOverlayProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onMissileFire: () => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ onDirectionChange, onMissileFire }) => {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const threshold = 15;
        let dx = 0;
        let dy = 0;
        
        if (gestureState.dx > threshold) dx = 1;
        else if (gestureState.dx < -threshold) dx = -1;
        
        if (gestureState.dy > threshold) dy = 1;
        else if (gestureState.dy < -threshold) dy = -1;
        
        onDirectionChange(dx, dy);
      },
      onPanResponderRelease: () => {
        onDirectionChange(0, 0);
      },
      onPanResponderTerminate: () => {
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
