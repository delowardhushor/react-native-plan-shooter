import { AppState, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

// Enable playback in silence mode
Sound.setCategory('Playback');

export type SoundType = 'shoot' | 'hit' | 'destroy' | 'hurt' | 'pickup' | 'warning' | 'win' | 'lose';
export type MusicTrack = 'menu' | 'battle' | 'boss';

const SFX_FILES: Record<SoundType, string> = {
  shoot: 'shoot.wav',
  hit: 'hit.wav',
  destroy: 'destroy.wav',
  hurt: 'hurt.wav',
  pickup: 'pickup.wav',
  warning: 'warning.wav',
  win: 'win.wav',
  lose: 'lose.wav',
};

const SFX_VOLUME: Partial<Record<SoundType, number>> = { lose: 1, win: 1, shoot: 0.7, hit: 0.8 };

const MUSIC_FILES: Record<MusicTrack, string> = {
  menu: 'music_menu.wav',
  battle: 'music_battle.wav',
  boss: 'music_boss.wav',
};

const MUSIC_VOLUME = 0.35;
const SETTINGS_KEY = 'planeshooter.sound.v1';

const sfx: Partial<Record<SoundType, Sound>> = {};
const music: Partial<Record<MusicTrack, Sound>> = {};
let started = false;
let muted = false;
let currentTrack: MusicTrack | null = null;
let appActive = true;
const listeners = new Set<(muted: boolean) => void>();

const load = (file: string, onLoaded?: (s: Sound) => void) => {
  const s: Sound = new Sound(file, Sound.MAIN_BUNDLE, err => {
    if (err) console.log('failed to load', file);
    else onLoaded?.(s);
  });
  return s;
};

const applyMusic = () => {
  (Object.keys(music) as MusicTrack[]).forEach(track => {
    const s = music[track];
    if (!s) return;
    if (track === currentTrack && !muted && appActive) s.play();
    else s.pause();
  });
};

// Safe to call repeatedly; sounds are loaded once for the whole app session
export const initSounds = () => {
  if (started) return;
  started = true;

  (Object.keys(SFX_FILES) as SoundType[]).forEach(type => {
    sfx[type] = load(SFX_FILES[type], s => s.setVolume(SFX_VOLUME[type] ?? 1));
  });
  (Object.keys(MUSIC_FILES) as MusicTrack[]).forEach(track => {
    music[track] = load(MUSIC_FILES[track], s => {
      s.setNumberOfLoops(-1);
      s.setVolume(MUSIC_VOLUME);
      if (track === currentTrack) applyMusic();
    });
  });

  AsyncStorage.getItem(SETTINGS_KEY)
    .then(raw => {
      if (raw && JSON.parse(raw).muted) setMuted(true, false);
    })
    .catch(() => {});

  // Music must never keep playing once the player leaves the app
  AppState.addEventListener('change', next => {
    appActive = next === 'active';
    applyMusic();
  });
};

export const playSound = (type: SoundType) => {
  if (muted) return;
  const s = sfx[type];
  if (s) s.stop(() => s.play());
};

export const playMusic = (track: MusicTrack | null) => {
  if (track === currentTrack) return;
  const previous = currentTrack && music[currentTrack];
  if (previous) previous.stop();
  currentTrack = track;
  applyMusic();
};

export const isMuted = () => muted;

export const setMuted = (value: boolean, persist = true) => {
  muted = value;
  if (muted) Vibration.cancel();
  applyMusic();
  listeners.forEach(fn => fn(muted));
  if (persist) AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted })).catch(() => {});
};

export const subscribeMuted = (fn: (muted: boolean) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// Haptics follow the same sound toggle, so one switch silences everything
export const buzz = (ms: number | number[]) => {
  if (!muted) Vibration.vibrate(ms);
};
