import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MissileType } from '../engine/Weapons';
import { DEFAULT_SKIN, skinById, type Skin } from '../engine/Skins';

export interface Progress {
  level: number;   // the level the player will play next
  points: number;  // upgrade currency
  armor: number;
  cannon: number;
  missiles: Record<MissileType, { owned: boolean; level: number }>;
  equipped: MissileType;
  bestScore: number; // highest score in a single run
  lastClaimDay: string; // local YYYY-MM-DD of the last daily reward, '' if never
  streak: number;       // consecutive days claimed
  ratePrompted: boolean; // the store-rating nudge is only ever shown once
  skin: string;          // equipped jet livery
  skinAds: Record<string, number>; // rewarded ads watched toward each ad-locked skin
}

const KEY = 'planeshooter.progress.v1';

export const defaultProgress = (): Progress => ({
  level: 1,
  points: 0,
  armor: 1,
  cannon: 1,
  missiles: {
    homing: { owned: true, level: 1 },
    blast: { owned: false, level: 1 },
    lance: { owned: false, level: 1 },
  },
  equipped: 'homing',
  bestScore: 0,
  lastClaimDay: '',
  streak: 0,
  ratePrompted: false,
  skin: DEFAULT_SKIN,
  skinAds: {},
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
      skinAds: { ...saved.skinAds },
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

// Points for a "WATCH AD" button: grows with the level so an ad stays worth about one level win
export const adRewardPoints = (level: number) => Math.min(250, 25 + (Math.max(1, level) - 1) * 5);

// The first few wins pay extra so a new player can afford their first upgrade within a couple of levels
const earlyWinBonus = (level: number) => Math.max(0, 5 - level) * 10;

// Points earned for finishing a run, win or lose
export const computeReward = (won: boolean, score: number, level: number) =>
  Math.floor(score / 10) + (won ? 10 + level * 2 + earlyWinBonus(level) : 0);

// Daily login reward: a 7-day cycle that rewards coming back on consecutive days
export const DAILY_REWARDS = [30, 40, 50, 60, 80, 100, 150];

export const dayKey = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export interface DailyStatus {
  claimable: boolean;
  streak: number;   // streak the player will be on after claiming
  dayIndex: number; // 0-based position in the 7-day cycle
  reward: number;
}

export const dailyStatus = (p: Progress, now: Date = new Date()): DailyStatus => {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const streak = p.lastClaimDay === yesterday ? p.streak + 1 : 1;
  const dayIndex = (streak - 1) % DAILY_REWARDS.length;
  return { claimable: p.lastClaimDay !== today, streak, dayIndex, reward: DAILY_REWARDS[dayIndex] };
};

export const claimDaily = (p: Progress, now: Date = new Date()): Progress => {
  const status = dailyStatus(p, now);
  if (!status.claimable) return p;
  return { ...p, points: p.points + status.reward, streak: status.streak, lastClaimDay: dayKey(now) };
};

// Skins unlock by being free, by reaching a level, or by watching enough rewarded ads
export const isSkinUnlocked = (p: Progress, skin: Skin) => {
  const u = skin.unlock;
  if (u.kind === 'free') return true;
  if (u.kind === 'level') return p.level >= u.level;
  return (p.skinAds[skin.id] ?? 0) >= u.count;
};

export const equippedSkin = (p: Progress) => {
  const skin = skinById(p.skin);
  return isSkinUnlocked(p, skin) ? skin : skinById(DEFAULT_SKIN);
};
