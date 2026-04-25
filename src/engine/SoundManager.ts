import Sound from 'react-native-sound';

// Enable playback in silence mode
Sound.setCategory('Playback');

export type SoundType = 'shoot' | 'hit' | 'destroy';

interface SoundBank {
  [key: string]: Sound | null;
}

const sounds: SoundBank = {
  shoot: null,
  hit: null,
  destroy: null
};

// Lazy loader handles cases where files are missing
export const initSounds = () => {
  sounds.shoot = new Sound('shoot.wav', Sound.MAIN_BUNDLE, (err) => {
    if (err) console.log('failed to load shoot sound');
  });
  sounds.hit = new Sound('hit.wav', Sound.MAIN_BUNDLE, (err) => {
    if (err) console.log('failed to load hit sound');
  });
  sounds.destroy = new Sound('destroy.wav', Sound.MAIN_BUNDLE, (err) => {
    if (err) console.log('failed to load destroy sound');
  });
};

export const playSound = (type: SoundType) => {
  const soundContext = sounds[type];
  if (soundContext) {
    // Rewind back to 0 instantly for overlapping overlaps
    soundContext.stop(() => {
      soundContext.play();
    });
  }
};
