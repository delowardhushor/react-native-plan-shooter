import { ENEMY_NAMES, EnemyType } from '../engine/Enemies';
import { ENEMY_UNLOCK_LEVEL } from '../engine/Levels';
import type { GameState } from '../engine/GameLoop';
import { dayKey, type DailyMissions, type MissionItem, type Progress } from './Progress';

// Run summary -------------------------------------------------------------------------------------
// A flat bag of numbers describing one finished run. Missions and achievements each watch one key.

export type RunSummary = Record<string, number>;

export const killKey = (type: number) => `kill:${type}`;

// Keys that keep the best value instead of adding up
const MAX_STATS = new Set(['bestCombo']);

export const summarizeRun = (s: GameState, won: boolean, stars: number): RunSummary => {
  const summary: RunSummary = {
    kills: s.kills,
    wins: won ? 1 : 0,
    bossKills: s.stats.bossKills,
    bestCombo: s.bestCombo,
    powerUps: s.stats.powerUps,
    bombs: s.stats.bombs,
    threeStars: won && stars >= 3 ? 1 : 0,
    flawless: won && s.stats.hitsTaken === 0 ? 1 : 0,
  };
  Object.entries(s.stats.killsByType).forEach(([type, n]) => { summary[killKey(Number(type))] = n; });
  return summary;
};

const accumulate = (current: number, key: string, value: number) =>
  MAX_STATS.has(key) ? Math.max(current, value) : current + value;

// Daily missions ----------------------------------------------------------------------------------

type Tier = [easy: number, medium: number, hard: number];
export const MISSION_REWARDS: Tier = [40, 60, 90];

interface MissionKind {
  stat: string;
  text: (n: number) => string;
  tiers: Tier;
  minLevel?: number;
}

const KINDS: MissionKind[] = [
  { stat: 'kills', text: n => `Destroy ${n} enemy planes`, tiers: [30, 60, 100] },
  { stat: 'wins', text: n => `Win ${n} level${n > 1 ? 's' : ''}`, tiers: [1, 2, 4] },
  { stat: 'bossKills', text: n => `Defeat ${n} boss${n > 1 ? 'es' : ''}`, tiers: [1, 2, 3], minLevel: 3 },
  { stat: 'bestCombo', text: n => `Reach a ${n} kill combo`, tiers: [8, 14, 22] },
  { stat: 'powerUps', text: n => `Collect ${n} power-ups`, tiers: [2, 4, 6] },
  { stat: 'bombs', text: n => `Use the bomb ${n} time${n > 1 ? 's' : ''}`, tiers: [1, 2, 3] },
  { stat: 'threeStars', text: n => `Earn 3 stars on ${n} level${n > 1 ? 's' : ''}`, tiers: [1, 2, 3] },
  { stat: 'flawless', text: n => `Win ${n} level${n > 1 ? 's' : ''} without being hit`, tiers: [1, 1, 2] },
];

// "Shoot down N <enemy>": picks one of the enemy planes the player has already met
const KILL_TIERS: Tier = [3, 5, 8];
const FODDER_TIERS: Tier = [12, 20, 30];

const unlockedTypes = (level: number): EnemyType[] =>
  (Object.values(EnemyType).filter(v => typeof v === 'number') as EnemyType[])
    .filter(t => t === EnemyType.STANDARD || (ENEMY_UNLOCK_LEVEL[t] ?? Infinity) <= level);

// Small deterministic PRNG so everyone's missions for a given day are stable across launches
const rng = (seed: string) => {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const rollMissions = (level: number, day: string): MissionItem[] => {
  const rnd = rng(day);
  const pool: Array<{ stat: string; text: (n: number) => string; tiers: Tier }> = KINDS.filter(
    k => (k.minLevel ?? 1) <= level,
  );
  const types = unlockedTypes(level);
  const type = types[Math.floor(rnd() * types.length)];
  pool.push({
    stat: killKey(type),
    text: n => `Shoot down ${n} ${ENEMY_NAMES[type]}${n > 1 ? 'S' : ''}`,
    tiers: type === EnemyType.STANDARD || type === EnemyType.SWARM ? FODDER_TIERS : KILL_TIERS,
  });

  const items: MissionItem[] = [];
  for (let tier = 0; tier < 3 && pool.length; tier++) {
    const [kind] = pool.splice(Math.floor(rnd() * pool.length), 1);
    const target = kind.tiers[tier];
    items.push({ stat: kind.stat, label: kind.text(target), target, reward: MISSION_REWARDS[tier], progress: 0, claimed: false });
  }
  return items;
};

// Today's missions, rolling a fresh set when the day has changed (pure: returns p itself if up to date)
export const ensureMissions = (p: Progress, now: Date = new Date()): Progress => {
  const day = dayKey(now);
  if (p.missions?.day === day) return p;
  return { ...p, missions: { day, items: rollMissions(p.level, day) } };
};

export const claimMission = (p: Progress, index: number, now: Date = new Date()): Progress => {
  const fresh = ensureMissions(p, now);
  const m = fresh.missions!.items[index];
  if (!m || m.claimed || m.progress < m.target) return fresh;
  const items = fresh.missions!.items.map((it, i) => (i === index ? { ...it, claimed: true } : it));
  return { ...fresh, points: fresh.points + m.reward, missions: { ...fresh.missions!, items } as DailyMissions };
};

// Achievements ------------------------------------------------------------------------------------

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  target: number;
  reward: number;
  value: (p: Progress) => number;
}

const life = (key: string) => (p: Progress) => p.lifetime[key] ?? 0;
const totalStars = (p: Progress) => Object.values(p.stars).reduce((a, b) => a + b, 0);
const levelsCleared = (p: Progress) => Math.max(0, p.level - 1);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'kills1', name: 'ROOKIE', desc: 'Destroy 100 enemy planes', target: 100, reward: 50, value: life('kills') },
  { id: 'kills2', name: 'ACE', desc: 'Destroy 1,000 enemy planes', target: 1000, reward: 200, value: life('kills') },
  { id: 'kills3', name: 'LEGEND', desc: 'Destroy 5,000 enemy planes', target: 5000, reward: 600, value: life('kills') },
  { id: 'boss1', name: 'GIANT KILLER', desc: 'Defeat a boss', target: 1, reward: 50, value: life('bossKills') },
  { id: 'boss2', name: 'BOSS HUNTER', desc: 'Defeat 15 bosses', target: 15, reward: 300, value: life('bossKills') },
  { id: 'combo1', name: 'ON FIRE', desc: 'Reach a 10 kill combo', target: 10, reward: 50, value: life('bestCombo') },
  { id: 'combo2', name: 'UNSTOPPABLE', desc: 'Reach a 25 kill combo', target: 25, reward: 150, value: life('bestCombo') },
  { id: 'combo3', name: 'RAMPAGE', desc: 'Reach a 50 kill combo', target: 50, reward: 400, value: life('bestCombo') },
  { id: 'power', name: 'POWER HUNGRY', desc: 'Collect 25 power-ups', target: 25, reward: 100, value: life('powerUps') },
  { id: 'bomb', name: 'DEMOLITION', desc: 'Use the bomb 20 times', target: 20, reward: 100, value: life('bombs') },
  { id: 'flawless', name: 'UNTOUCHABLE', desc: 'Win 5 levels without being hit', target: 5, reward: 150, value: life('flawless') },
  { id: 'stars', name: 'STAR PILOT', desc: 'Collect 30 stars on the campaign map', target: 30, reward: 200, value: totalStars },
  { id: 'lvl1', name: 'VETERAN', desc: 'Clear 10 levels', target: 10, reward: 100, value: levelsCleared },
  { id: 'lvl2', name: 'COMMANDER', desc: 'Clear 25 levels', target: 25, reward: 300, value: levelsCleared },
  { id: 'lvl3', name: 'WARLORD', desc: 'Clear 50 levels', target: 50, reward: 800, value: levelsCleared },
];

export const achievementProgress = (p: Progress, a: Achievement) => Math.min(a.target, a.value(p));
export const isAchievementDone = (p: Progress, a: Achievement) => a.value(p) >= a.target;
export const isAchievementClaimable = (p: Progress, a: Achievement) => isAchievementDone(p, a) && !p.achClaimed[a.id];

export const claimAchievement = (p: Progress, id: string): Progress => {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a || !isAchievementClaimable(p, a)) return p;
  return { ...p, points: p.points + a.reward, achClaimed: { ...p.achClaimed, [id]: true } };
};

// Applying a finished run -------------------------------------------------------------------------

export const applyRunSummary = (p: Progress, summary: RunSummary, now: Date = new Date()): Progress => {
  const fresh = ensureMissions(p, now);
  const lifetime = { ...fresh.lifetime };
  Object.entries(summary).forEach(([key, v]) => {
    if (key.startsWith('kill:')) return; // per-type counts only matter to missions
    lifetime[key] = accumulate(lifetime[key] ?? 0, key, v);
  });
  const items = fresh.missions!.items.map(m => {
    if (m.claimed || m.progress >= m.target) return m;
    const v = summary[m.stat];
    if (!v) return m;
    return { ...m, progress: Math.min(m.target, accumulate(m.progress, m.stat, v)) };
  });
  return { ...fresh, lifetime, missions: { ...fresh.missions!, items } };
};

// Anything waiting to be collected (drives the red "!" on the menu button)
export const unclaimedCount = (p: Progress, now: Date = new Date()) => {
  const missions = ensureMissions(p, now).missions!.items.filter(m => !m.claimed && m.progress >= m.target).length;
  return missions + ACHIEVEMENTS.filter(a => isAchievementClaimable(p, a)).length;
};
