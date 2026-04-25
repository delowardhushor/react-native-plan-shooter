import React from 'react';
import { StyleSheet, View, PanResponder } from 'react-native';

interface TouchOverlayProps {
  onGrant: () => void;
  onMove: (dy: number, dx: number) => void;
  onTap?: () => void;
}

export const TouchOverlay: React.FC<TouchOverlayProps> = ({ onGrant, onMove, onTap }) => {
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        onGrant();
      },
      onPanResponderMove: (evt, gestureState) => {
        // gestureState.dx/dy are the total distance moved since touch started
        onMove(gestureState.dy, gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Detect tap
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          if (onTap) onTap();
        }
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]}
      {...panResponder.panHandlers}
    />
  );
};
