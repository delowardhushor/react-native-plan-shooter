import { Platform } from 'react-native';
import mobileAds, { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

// Where a rewarded ad is shown. Each placement can have its own AdMob unit.
export type AdPlacement = 'points' | 'doubleReward' | 'continue' | 'skin';

// Real unit ids are Android-only for now and never used in debug builds, so developing
// can't produce invalid traffic on the live account. Everything else serves Google's test ads.
const LIVE_UNIT_IDS: Partial<Record<AdPlacement, string>> = Platform.select({
  android: {
    continue: 'ca-app-pub-3142399721849091/4293085258',
    points: 'ca-app-pub-3142399721849091/6725922882', // menu / upgrade-screen "WATCH AD"
    skin: 'ca-app-pub-3142399721849091/6725922882', // hangar skin unlocks share the points unit until it gets its own
    doubleReward: 'ca-app-pub-3142399721849091/4155599867', // "DOUBLE POINTS" on the result card
  },
  default: {},
});

export const AD_UNIT_IDS: Record<AdPlacement, string> = {
  points: TestIds.REWARDED,
  doubleReward: TestIds.REWARDED,
  continue: TestIds.REWARDED,
  skin: TestIds.REWARDED,
  ...(__DEV__ ? {} : LIVE_UNIT_IDS),
};

const LOAD_TIMEOUT_MS = 15000;

export const initAds = () => {
  mobileAds()
    .initialize()
    .then(() => preloadRewardedAd('continue'))
    .catch(() => {});
};

const ready: Partial<Record<AdPlacement, RewardedAd>> = {};
const loading: Partial<Record<AdPlacement, boolean>> = {};

// Loads the next ad for a placement ahead of time so the button responds instantly
export const preloadRewardedAd = (placement: AdPlacement) => {
  if (ready[placement] || loading[placement]) return;
  loading[placement] = true;
  const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS[placement]);
  const done = () => {
    loading[placement] = false;
    unsubLoaded();
    unsubError();
  };
  const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    ready[placement] = ad;
    done();
  });
  const unsubError = ad.addAdEventListener(AdEventType.ERROR, done);
  ad.load();
};

const loadNow = (placement: AdPlacement) =>
  new Promise<RewardedAd | null>(resolve => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_IDS[placement]);
    const timer = setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
    const finish = (result: RewardedAd | null) => {
      clearTimeout(timer);
      unsubLoaded();
      unsubError();
      resolve(result);
    };
    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => finish(ad));
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => finish(null));
    ad.load();
  });

// Resolves true only when the viewer earned the reward; false if closed early or no ad was available
export const showRewardedAd = async (placement: AdPlacement = 'points'): Promise<boolean> => {
  const preloaded = ready[placement];
  delete ready[placement];
  const ad = preloaded ?? (await loadNow(placement));
  if (!ad) {
    preloadRewardedAd(placement);
    return false;
  }

  return new Promise<boolean>(resolve => {
    let earned = false;
    const unsubs = [
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(AdEventType.ERROR, () => finish(false)),
    ];
    const finish = (result: boolean) => {
      unsubs.forEach(u => u());
      preloadRewardedAd(placement);
      resolve(result);
    };
    ad.show().catch(() => finish(false));
  });
};
