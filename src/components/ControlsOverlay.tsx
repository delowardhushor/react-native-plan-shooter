import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { COLOR_FG } from '../engine/Constants';

interface ControlsOverlayProps {
  onDirectionChange: (dx: number, dy: number) => void;
  onMissileFire: () => void;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ onDirectionChange, onMissileFire }) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      
      {/* Invisible grid maps standard tap bounds natively without complex PanResponder swipes! */}
      <View style={styles.leftHalf}>
        <View style={styles.dpadGrid}>
          <View style={styles.gridRow}>
             <View style={styles.gridCell}/>
             <TouchableOpacity style={styles.gridCellTouch} onPressIn={() => onDirectionChange(0, -1)} onPressOut={() => onDirectionChange(0, 0)} activeOpacity={1} />
             <View style={styles.gridCell}/>
          </View>
          <View style={styles.gridRow}>
             <TouchableOpacity style={styles.gridCellTouch} onPressIn={() => onDirectionChange(-1, 0)} onPressOut={() => onDirectionChange(0, 0)} activeOpacity={1} />
             <View style={styles.gridCell}/>
             <TouchableOpacity style={styles.gridCellTouch} onPressIn={() => onDirectionChange(1, 0)} onPressOut={() => onDirectionChange(0, 0)} activeOpacity={1} />
          </View>
          <View style={styles.gridRow}>
             <View style={styles.gridCell}/>
             <TouchableOpacity style={styles.gridCellTouch} onPressIn={() => onDirectionChange(0, 1)} onPressOut={() => onDirectionChange(0, 0)} activeOpacity={1} />
             <View style={styles.gridCell}/>
          </View>
        </View>
      </View>
      
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
    padding: 20,
    paddingTop: 80, 
    justifyContent: 'center'
  },
  dpadGrid: {
    width: '100%',
    height: '100%',
    maxWidth: 250,
    maxHeight: 250,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
  },
  gridCellTouch: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.01)', 
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
