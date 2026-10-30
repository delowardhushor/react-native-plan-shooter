jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import { armorUpgradeCost } from '../src/engine/Armor';
import { cannonUpgradeCost } from '../src/engine/Weapons';
import { adRewardPoints, computeReward } from '../src/state/Progress';

describe('early economy', () => {
  it('lets a new player afford the first armor upgrade within two level wins', () => {
    const afterTwoWins = computeReward(true, 100, 1) + computeReward(true, 130, 2);
    expect(afterTwoWins).toBeGreaterThanOrEqual(armorUpgradeCost(1));
  });

  it('lets a new player afford the first cannon upgrade within three level wins', () => {
    const afterThreeWins = computeReward(true, 100, 1) + computeReward(true, 130, 2) + computeReward(true, 150, 3);
    expect(afterThreeWins).toBeGreaterThanOrEqual(cannonUpgradeCost(1));
  });

  it('stops paying the early bonus from level 5', () => {
    expect(computeReward(true, 0, 5)).toBe(10 + 5 * 2);
  });

  it('ad rewards start at 25, grow with the level and are capped', () => {
    expect(adRewardPoints(1)).toBe(25);
    expect(adRewardPoints(2)).toBeGreaterThan(adRewardPoints(1));
    expect(adRewardPoints(10)).toBe(70);
    expect(adRewardPoints(500)).toBe(250);
    expect(adRewardPoints(0)).toBe(25);
  });
});

describe('campaign stars and replay rewards', () => {
  const { computeStars, computeRunReward, starsFor, defaultProgress, STAR_BONUS } = require('../src/state/Progress');

  it('rates a run by the hull left, and caps it at 1 star after an ad continue', () => {
    expect(computeStars(1, 0)).toBe(3);
    expect(computeStars(0.7, 0)).toBe(3);
    expect(computeStars(0.5, 0)).toBe(2);
    expect(computeStars(0.1, 0)).toBe(1);
    expect(computeStars(1, 1)).toBe(1);
  });

  it('treats levels cleared before stars existed as 1 star, and the frontier as 0', () => {
    const p = { ...defaultProgress(), level: 5 };
    expect(starsFor(p, 3)).toBe(1);
    expect(starsFor(p, 5)).toBe(0);
    expect(starsFor({ ...p, stars: { 3: 3 } }, 3)).toBe(3);
  });

  it('pays full for a first clear, half for a replay, and a bonus per new star', () => {
    const first = computeRunReward({ won: true, score: 100, level: 6, isReplay: false, stars: 2, prevStars: 0 });
    const replay = computeRunReward({ won: true, score: 100, level: 6, isReplay: true, stars: 2, prevStars: 2 });
    expect(first).toBe(computeReward(true, 100, 6) + 2 * STAR_BONUS);
    expect(replay).toBe(Math.floor(computeReward(true, 100, 6) / 2));
    const improved = computeRunReward({ won: true, score: 100, level: 6, isReplay: true, stars: 3, prevStars: 2 });
    expect(improved).toBe(replay + STAR_BONUS);
  });

  it('pays no star bonus for a loss', () => {
    expect(computeRunReward({ won: false, score: 100, level: 6, isReplay: false, stars: 0, prevStars: 0 })).toBe(10);
  });
});
