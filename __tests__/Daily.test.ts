jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import { DAILY_REWARDS, claimDaily, dailyStatus, defaultProgress } from '../src/state/Progress';

const day = (n: number) => new Date(2026, 9, n, 12);

describe('daily reward', () => {
  it('is claimable on a fresh install and starts the streak at 1', () => {
    const s = dailyStatus(defaultProgress(), day(10));
    expect(s).toMatchObject({ claimable: true, streak: 1, dayIndex: 0, reward: DAILY_REWARDS[0] });
  });

  it('can only be claimed once per day', () => {
    const once = claimDaily(defaultProgress(), day(10));
    expect(once.points).toBe(DAILY_REWARDS[0]);
    expect(claimDaily(once, day(10))).toBe(once);
  });

  it('extends the streak on consecutive days and pays more', () => {
    const d1 = claimDaily(defaultProgress(), day(10));
    const d2 = claimDaily(d1, day(11));
    expect(d2.streak).toBe(2);
    expect(d2.points).toBe(DAILY_REWARDS[0] + DAILY_REWARDS[1]);
  });

  it('resets the streak after a missed day', () => {
    const d1 = claimDaily(defaultProgress(), day(10));
    const later = claimDaily(d1, day(13));
    expect(later.streak).toBe(1);
  });

  it('wraps back to day 1 after the 7th day, keeping the streak count', () => {
    let p = defaultProgress();
    for (let i = 0; i < 7; i++) p = claimDaily(p, day(10 + i));
    const next = dailyStatus(p, day(17));
    expect(next.streak).toBe(8);
    expect(next.dayIndex).toBe(0);
  });

  it('works across a month boundary', () => {
    const last = claimDaily(defaultProgress(), new Date(2026, 9, 31, 22));
    expect(dailyStatus(last, new Date(2026, 10, 1, 8)).streak).toBe(2);
  });
});
