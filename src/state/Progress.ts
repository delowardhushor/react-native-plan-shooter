import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MissileType } from '../engine/Weapons';

export interface Progress {
  level: number;   // the level the player will play next
  points: number;  // upgrade currency
  cannon: number;
  missiles: Record<MissileType, { owned: boolean; level: number }>;
  equipped: MissileType;
}

const KEY = 'planeshooter.progress.v1';

export const defaultProgress = (): Progress => ({
  level: 1,
  points: 0,
  cannon: 1,
  missiles: {
    homing: { owned: true, level: 1 },
    blast: { owned: false, level: 1 },
    lance: { owned: false, level: 1 },
  },
  equipped: 'homing',
});

export const loadProgress = async (): Promise<Progress> => {
  const base = defaultProgress();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Progress>;
    return {
      ...base,
      ...saved,
      missiles: {
        homing: { ...base.missiles.homing, ...saved.missiles?.homing },
        blast: { ...base.missiles.blast, ...saved.missiles?.blast },
        lance: { ...base.missiles.lance, ...saved.missiles?.lance },
      },
    };
  } catch {
    return base;
  }
};

export const saveProgress = (progress: Progress) => {
  AsyncStorage.setItem(KEY, JSON.stringify(progress)).catch(() => {});
};

// Points earned for finishing a run, win or lose
export const computeReward = (won: boolean, score: number, level: number) =>
  Math.floor(score / 4) + (won ? 25 + level * 5 : 0);
