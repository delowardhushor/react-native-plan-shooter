jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import { armorUpgradeCost } from '../src/engine/Armor';
import { cannonUpgradeCost } from '../src/engine/Weapons';
import { computeReward } from '../src/state/Progress';

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
});
