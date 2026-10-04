import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GameCanvas } from './src/components/GameCanvas';
import { MenuScreen } from './src/components/MenuScreen';
import { UpgradeScreen, type UpgradeActions } from './src/components/UpgradeScreen';
import { AdOverlay } from './src/components/AdOverlay';
import type { Loadout } from './src/engine/GameLoop';
import {
  MAX_CANNON_LEVEL, MAX_MISSILE_LEVEL, MISSILES, cannonUpgradeCost, missileUpgradeCost, type MissileType,
} from './src/engine/Weapons';
import { loadProgress, saveProgress, type Progress } from './src/state/Progress';

type Screen = 'menu' | 'upgrades' | 'game';

interface Run {
  id: number;
  level: number;
  loadout: Loadout;
}

const loadoutOf = (p: Progress): Loadout => ({
  cannon: p.cannon,
  missile: p.equipped,
  missileLevel: p.missiles[p.equipped].level,
});

const App = () => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress(prev => {
      if (!prev) return prev;
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const startRun = (level: number) => {
    if (!progress) return;
    setRun(r => ({ id: (r?.id ?? 0) + 1, level, loadout: loadoutOf(progress) }));
    setScreen('game');
  };

  const actions: UpgradeActions = {
    addPoints: points => update(p => ({ ...p, points: p.points + points })),
    upgradeCannon: () =>
      update(p => {
        const cost = cannonUpgradeCost(p.cannon);
        if (p.cannon >= MAX_CANNON_LEVEL || p.points < cost) return p;
        return { ...p, points: p.points - cost, cannon: p.cannon + 1 };
      }),
    unlockMissile: (type: MissileType) =>
      update(p => {
        const cost = MISSILES[type].unlockCost;
        if (p.missiles[type].owned || p.points < cost) return p;
        return {
          ...p,
          points: p.points - cost,
          equipped: type,
          missiles: { ...p.missiles, [type]: { owned: true, level: 1 } },
        };
      }),
    upgradeMissile: (type: MissileType) =>
      update(p => {
        const m = p.missiles[type];
        const cost = missileUpgradeCost(m.level);
        if (!m.owned || m.level >= MAX_MISSILE_LEVEL || p.points < cost) return p;
        return { ...p, points: p.points - cost, missiles: { ...p.missiles, [type]: { ...m, level: m.level + 1 } } };
      }),
    equipMissile: (type: MissileType) =>
      update(p => (p.missiles[type].owned ? { ...p, equipped: type } : p)),
  };

  let content: React.ReactNode = null;
  if (progress) {
    if (screen === 'game' && run) {
      content = (
        <GameCanvas
          key={run.id}
          level={run.level}
          loadout={run.loadout}
          onFinish={(won, reward) =>
            update(p => ({
              ...p,
              points: p.points + reward,
              // Only advance when the player beat their frontier level
              level: won && run.level === p.level ? p.level + 1 : p.level,
            }))
          }
          onBonusPoints={actions.addPoints}
          onNext={() => startRun(run.level + 1)}
          onRetry={() => startRun(run.level)}
          onMenu={() => setScreen('menu')}
        />
      );
    } else if (screen === 'upgrades') {
      content = <UpgradeScreen progress={progress} actions={actions} onBack={() => setScreen('menu')} />;
    } else {
      content = (
        <MenuScreen
          progress={progress}
          onPlay={() => startRun(progress.level)}
          onUpgrades={() => setScreen('upgrades')}
          onAdPoints={actions.addPoints}
        />
      );
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {content}
      <AdOverlay />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});

export default App;
