// Cosmetic jet liveries. A skin changes only how the player's jet looks, never its stats.

export interface HeroPalette {
  bodyTop: string;
  bodyMid: string;
  bodyLow: string;
  wingNear: [string, string];
  wingFar: string;
  farFin: string;
  tailFin: [string, string];
  canopy: [string, string];
  accent: string;   // stripe, tail flash and leading edges
  accentHi: string; // the same trim on a tier-5 jet
}

export type SkinUnlock =
  | { kind: 'free' }
  | { kind: 'level'; level: number } // reach this level
  | { kind: 'ads'; count: number };  // watch this many rewarded ads

export interface Skin {
  id: string;
  name: string;
  unlock: SkinUnlock;
  ui: string; // card and menu highlight colour
  palette: HeroPalette;
}

export const SKINS: Skin[] = [
  {
    id: 'falcon', name: 'FALCON', unlock: { kind: 'free' }, ui: '#4a86dc',
    palette: {
      bodyTop: '#f6f9ff', bodyMid: '#4a86dc', bodyLow: '#16336a',
      wingNear: ['#8bb8f7', '#1e4690'], wingFar: '#17305f', farFin: '#1d3c75',
      tailFin: ['#eef4ff', '#5f93e0'], canopy: ['#d4f8ff', '#1a6fd6'],
      accent: '#ffb23e', accentHi: '#ffd35a',
    },
  },
  {
    id: 'crimson', name: 'CRIMSON', unlock: { kind: 'level', level: 4 }, ui: '#e0453a',
    palette: {
      bodyTop: '#fff5f2', bodyMid: '#e0453a', bodyLow: '#6b1713',
      wingNear: ['#ff9a8b', '#8e2019'], wingFar: '#5a1410', farFin: '#6e1d18',
      tailFin: ['#fff0ee', '#e8776c'], canopy: ['#d4f8ff', '#1a6fd6'],
      accent: '#ffe27a', accentHi: '#fff1a8',
    },
  },
  {
    id: 'stealth', name: 'STEALTH', unlock: { kind: 'ads', count: 3 }, ui: '#2ef2d0',
    palette: {
      bodyTop: '#8b95a3', bodyMid: '#2f3642', bodyLow: '#0f1218',
      wingNear: ['#566070', '#1a1e26'], wingFar: '#0d1015', farFin: '#161a22',
      tailFin: ['#7d8795', '#2a303b'], canopy: ['#b8fff3', '#0aa58a'],
      accent: '#2ef2d0', accentHi: '#8dfbe8',
    },
  },
  {
    id: 'viper', name: 'VIPER', unlock: { kind: 'level', level: 9 }, ui: '#3fbf6a',
    palette: {
      bodyTop: '#f1fff4', bodyMid: '#3fbf6a', bodyLow: '#12522e',
      wingNear: ['#8be6a8', '#1e7a43'], wingFar: '#0f3d23', farFin: '#1a5c38',
      tailFin: ['#eafff0', '#5fd68a'], canopy: ['#d4f8ff', '#1a6fd6'],
      accent: '#ffe45a', accentHi: '#fff08a',
    },
  },
  {
    id: 'eagle', name: 'GOLDEN EAGLE', unlock: { kind: 'ads', count: 5 }, ui: '#f0b429',
    palette: {
      bodyTop: '#fffbea', bodyMid: '#f0b429', bodyLow: '#7a4b06',
      wingNear: ['#ffe08a', '#a86a0c'], wingFar: '#5c3a05', farFin: '#7a4f0a',
      tailFin: ['#fff4cf', '#f2c14e'], canopy: ['#d4f8ff', '#1a6fd6'],
      accent: '#e8483a', accentHi: '#ff7a5c',
    },
  },
];

export const DEFAULT_SKIN = 'falcon';

export const skinById = (id: string | undefined): Skin => SKINS.find(s => s.id === id) ?? SKINS[0];

export const skinIndex = (id: string | undefined) => Math.max(0, SKINS.findIndex(s => s.id === id));

// Short description of how to get a locked skin, e.g. "REACH LEVEL 4" or "WATCH 3 ADS"
export const unlockText = (u: SkinUnlock) =>
  u.kind === 'level' ? `REACH LEVEL ${u.level}` : u.kind === 'ads' ? `WATCH ${u.count} ADS` : 'UNLOCKED';
