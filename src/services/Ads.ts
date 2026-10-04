// Rewarded-ad seam. Today a simulated overlay (AdOverlay) presents the "ad";
// to go live, replace the presenter with a react-native-google-mobile-ads RewardedAd
// that resolves true only when the user earns the reward.
type Presenter = () => Promise<boolean>;

let presenter: Presenter | null = null;

export const registerAdPresenter = (p: Presenter) => {
  presenter = p;
  return () => {
    if (presenter === p) presenter = null;
  };
};

export const REWARD_AD_POINTS = 50;

export const showRewardedAd = (): Promise<boolean> => (presenter ? presenter() : Promise.resolve(false));
