import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GameCanvas } from './src/components/GameCanvas';
import { MenuScreen } from './src/components/MenuScreen';
import { SkinsScreen, type SkinActions } from './src/components/SkinsScreen';
import { UpgradeScreen, type UpgradeActions } from './src/components/UpgradeScreen';
import { initAds } from './src/services/Ads';
import { initSounds, playMusic } from './src/engine/SoundManager';
import { SKINS, skinById } from './src/engine/Skins';
import type { Loadout } from './src/engine/GameLoop';
import { MAX_ARMOR_LEVEL, armorMaxHp, armorUpgradeCost } from './src/engine/Armor';
import {
  MAX_CANNON_LEVEL, MAX_MISSILE_LEVEL, MISSILES, cannonUpgradeCost, missileUpgradeCost, type MissileType,
} from './src/engine/Weapons';
import { claimDaily, equippedSkin, isSkinUnlocked, loadProgress, saveProgress, type Progress } from './src/state/Progress';

type Screen = 'menu' | 'upgrades' | 'skins' | 'game';

interface Run {
  id: number;
  level: number;
  loadout: Loadout;
  bestScore: number; // best score when the run began, so the result card can flag a new record
}

const loadoutOf = (p: Progress): Loadout => ({
  skin: equippedSkin(p).id,
  maxHp: armorMaxHp(p.armor),
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
    initAds();
    initSounds();
  }, []);

  useEffect(() => {
    if (screen !== 'game') playMusic('menu');
  }, [screen]);

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
    setRun(r => ({ id: (r?.id ?? 0) + 1, level, loadout: loadoutOf(progress), bestScore: progress.bestScore }));
    setScreen('game');
  };

  const actions: UpgradeActions & SkinActions & { claimDaily: () => void; markRatePrompted: () => void } = {
    equipSkin: id => update(p => (isSkinUnlocked(p, skinById(id)) ? { ...p, skin: id } : p)),
    // Finishing the last ad of a skin unlocks it and equips it straight away
    addSkinAd: id =>
      update(p => {
        const skin = SKINS.find(s => s.id === id);
        if (!skin || skin.unlock.kind !== 'ads') return p;
        const next = { ...p, skinAds: { ...p.skinAds, [id]: (p.skinAds[id] ?? 0) + 1 } };
        return !isSkinUnlocked(p, skin) && isSkinUnlocked(next, skin) ? { ...next, skin: id } : next;
      }),
    claimDaily: () => update(p => claimDaily(p)),
    markRatePrompted: () => update(p => (p.ratePrompted ? p : { ...p, ratePrompted: true })),
    addPoints: points => update(p => ({ ...p, points: p.points + points })),
    upgradeArmor: () =>
      update(p => {
        const cost = armorUpgradeCost(p.armor);
        if (p.armor >= MAX_ARMOR_LEVEL || p.points < cost) return p;
        return { ...p, points: p.points - cost, armor: p.armor + 1 };
      }),
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
          bestScore={run.bestScore}
          showRatePrompt={!progress.ratePrompted}
          onRatePromptShown={actions.markRatePrompted}
          onFinish={(won, reward, score) =>
            update(p => ({
              ...p,
              points: p.points + reward,
              bestScore: Math.max(p.bestScore, score),
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
    } else if (screen === 'skins') {
      content = <SkinsScreen progress={progress} actions={actions} onBack={() => setScreen('menu')} />;
    } else if (screen === 'upgrades') {
      content = <UpgradeScreen progress={progress} actions={actions} onBack={() => setScreen('menu')} />;
    } else {
      content = (
        <MenuScreen
          progress={progress}
          onPlay={() => startRun(progress.level)}
          onUpgrades={() => setScreen('upgrades')}
          onSkins={() => setScreen('skins')}
          onAdPoints={actions.addPoints}
          onClaimDaily={actions.claimDaily}
        />
      );
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {content}
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
