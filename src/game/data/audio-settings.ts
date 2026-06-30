export const MUSIC_VOLUME_STORAGE_KEY = "grassTouching.menuMusicVolume";
export const SFX_VOLUME_STORAGE_KEY = "grassTouching.sfxVolume";
export const DEFAULT_MUSIC_VOLUME = 0.62;
export const DEFAULT_SFX_VOLUME = 1;

export function readStoredMusicVolume(): number {
  const stored = window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_MUSIC_VOLUME;
  }

  const storedVolume = Number(stored);
  return Number.isFinite(storedVolume) ? clampVolume(storedVolume) : DEFAULT_MUSIC_VOLUME;
}

export function writeStoredMusicVolume(volume: number): number {
  const clampedVolume = clampVolume(volume);
  window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, clampedVolume.toFixed(2));
  return clampedVolume;
}

export function readStoredSfxVolume(): number {
  const stored = window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_SFX_VOLUME;
  }

  const storedVolume = Number(stored);
  return Number.isFinite(storedVolume) ? clampVolume(storedVolume) : DEFAULT_SFX_VOLUME;
}

export function writeStoredSfxVolume(volume: number): number {
  const clampedVolume = clampVolume(volume);
  window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, clampedVolume.toFixed(2));
  return clampedVolume;
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}
