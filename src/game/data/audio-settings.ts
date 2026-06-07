export const MUSIC_VOLUME_STORAGE_KEY = "grassTouching.menuMusicVolume";
export const DEFAULT_MUSIC_VOLUME = 0.72;

export function readStoredMusicVolume(): number {
  const storedVolume = Number(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY));
  return Number.isFinite(storedVolume) ? clampVolume(storedVolume) : DEFAULT_MUSIC_VOLUME;
}

export function writeStoredMusicVolume(volume: number): number {
  const clampedVolume = clampVolume(volume);
  window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, clampedVolume.toFixed(2));
  return clampedVolume;
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}
