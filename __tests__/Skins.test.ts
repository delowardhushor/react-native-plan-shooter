jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()) },
}));

import { SKINS, skinById } from '../src/engine/Skins';
import { defaultProgress, equippedSkin, isSkinUnlocked } from '../src/state/Progress';

describe('skins', () => {
  it('only the default livery is free on a fresh install', () => {
    const p = defaultProgress();
    expect(SKINS.filter(s => isSkinUnlocked(p, s)).map(s => s.id)).toEqual(['falcon']);
  });

  it('level skins unlock once the player reaches the level', () => {
    const crimson = skinById('crimson');
    expect(isSkinUnlocked({ ...defaultProgress(), level: 3 }, crimson)).toBe(false);
    expect(isSkinUnlocked({ ...defaultProgress(), level: 4 }, crimson)).toBe(true);
  });

  it('ad skins need every ad watched', () => {
    const stealth = skinById('stealth');
    expect(isSkinUnlocked({ ...defaultProgress(), skinAds: { stealth: 2 } }, stealth)).toBe(false);
    expect(isSkinUnlocked({ ...defaultProgress(), skinAds: { stealth: 3 } }, stealth)).toBe(true);
  });

  it('falls back to the default livery if the equipped one is not unlocked', () => {
    expect(equippedSkin({ ...defaultProgress(), skin: 'eagle' }).id).toBe('falcon');
    expect(equippedSkin({ ...defaultProgress(), skin: 'nonsense' }).id).toBe('falcon');
  });

  it('every skin has a unique id', () => {
    expect(new Set(SKINS.map(s => s.id)).size).toBe(SKINS.length);
  });
});
