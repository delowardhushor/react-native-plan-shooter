jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import { createInitialState } from '../src/engine/GameLoop';
import { EnemyType } from '../src/engine/Enemies';
import { defaultProgress, dayKey } from '../src/state/Progress';
import {
  ACHIEVEMENTS, applyRunSummary, claimAchievement, claimMission, ensureMissions, killKey, rollMissions,
  summarizeRun, unclaimedCount, MISSION_REWARDS,
} from '../src/state/Missions';

const day = (n: number) => new Date(2026, 9, n, 12);
const loadout = { maxHp: 5, cannon: 1, missile: 'homing' as const, missileLevel: 1 };

describe('daily missions', () => {
  it('rolls three missions, easy to hard, for the same day identically every time', () => {
    const a = rollMissions(8, dayKey(day(10)));
    const b = rollMissions(8, dayKey(day(10)));
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(a.map(m => m.reward)).toEqual(MISSION_REWARDS);
    expect(new Set(a.map(m => m.stat)).size).toBe(3);
  });

  it('differs between days', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) seen.add(rollMissions(8, dayKey(day(d))).map(m => m.stat).join());
    expect(seen.size).toBeGreaterThan(5);
  });

  it('never asks for a boss or an enemy the player has not met', () => {
    for (let d = 1; d <= 28; d++) {
      rollMissions(1, dayKey(day(d))).forEach(m => {
        expect(m.stat).not.toBe('bossKills');
        if (m.stat.startsWith('kill:')) expect(m.stat).toBe(killKey(EnemyType.STANDARD));
      });
    }
  });

  it('are created on first use and re-rolled on a new day', () => {
    const p = ensureMissions(defaultProgress(), day(10));
    expect(p.missions?.day).toBe(dayKey(day(10)));
    expect(ensureMissions(p, day(10))).toBe(p);
    const next = ensureMissions(p, day(11));
    expect(next.missions?.day).toBe(dayKey(day(11)));
  });

  it('count run results: sums add up, best combo keeps the best', () => {
    let p = ensureMissions(defaultProgress(), day(10));
    p = { ...p, missions: { day: p.missions!.day, items: [
      { stat: 'kills', label: 'k', target: 30, reward: 40, progress: 0, claimed: false },
      { stat: 'bestCombo', label: 'c', target: 20, reward: 60, progress: 0, claimed: false },
      { stat: 'bombs', label: 'b', target: 2, reward: 90, progress: 0, claimed: false },
    ] } };
    p = applyRunSummary(p, { kills: 12, bestCombo: 9, bombs: 1 }, day(10));
    p = applyRunSummary(p, { kills: 10, bestCombo: 6, bombs: 1 }, day(10));
    const [kills, combo, bombs] = p.missions!.items;
    expect(kills.progress).toBe(22);
    expect(combo.progress).toBe(9);
    expect(bombs.progress).toBe(2);
  });

  it('progress is capped and a claim pays once, only when complete', () => {
    let p = ensureMissions(defaultProgress(), day(10));
    const first = p.missions!.items[0];
    p = applyRunSummary(p, { [first.stat]: 9999 }, day(10));
    expect(p.missions!.items[0].progress).toBe(first.target);
    expect(claimMission(ensureMissions(defaultProgress(), day(10)), 0, day(10)).points).toBe(0);
    const claimed = claimMission(p, 0, day(10));
    expect(claimed.points).toBe(first.reward);
    expect(claimMission(claimed, 0, day(10)).points).toBe(first.reward);
    expect(claimed.missions!.items[0].claimed).toBe(true);
  });
});

describe('achievements', () => {
  it('lifetime totals accumulate across runs', () => {
    let p = defaultProgress();
    p = applyRunSummary(p, { kills: 60, bestCombo: 12, bossKills: 1 }, day(10));
    p = applyRunSummary(p, { kills: 50, bestCombo: 8 }, day(10));
    expect(p.lifetime.kills).toBe(110);
    expect(p.lifetime.bestCombo).toBe(12);
    expect(p.lifetime.bossKills).toBe(1);
  });

  it('can be claimed once when reached', () => {
    let p = applyRunSummary(defaultProgress(), { kills: 100 }, day(10));
    const rookie = ACHIEVEMENTS.find(a => a.id === 'kills1')!;
    expect(unclaimedCount(p, day(10))).toBeGreaterThan(0);
    p = claimAchievement(p, 'kills1');
    expect(p.points).toBe(rookie.reward);
    expect(claimAchievement(p, 'kills1').points).toBe(rookie.reward);
    expect(claimAchievement(p, 'kills2').points).toBe(rookie.reward); // not reached yet
  });

  it('level and star achievements follow campaign progress', () => {
    const p = { ...defaultProgress(), level: 11, stars: { 1: 3, 2: 3 } };
    expect(ACHIEVEMENTS.find(a => a.id === 'lvl1')!.value(p)).toBe(10);
    expect(ACHIEVEMENTS.find(a => a.id === 'stars')!.value(p)).toBe(6);
  });
});

describe('run summary', () => {
  it('reads kills, bosses, bombs and flawless wins from a finished run', () => {
    const s = createInitialState(1, loadout);
    s.kills = 14;
    s.bestCombo = 11;
    s.stats.bombs = 1;
    s.stats.killsByType[EnemyType.STANDARD] = 14;
    const win = summarizeRun(s, true, 3);
    expect(win).toMatchObject({ kills: 14, bestCombo: 11, bombs: 1, wins: 1, threeStars: 1, flawless: 1, [killKey(0)]: 14 });
    s.stats.hitsTaken = 1;
    expect(summarizeRun(s, true, 2)).toMatchObject({ flawless: 0, threeStars: 0 });
    expect(summarizeRun(s, false, 0)).toMatchObject({ wins: 0, flawless: 0 });
  });
});
