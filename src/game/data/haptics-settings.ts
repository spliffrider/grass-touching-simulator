export const HAPTICS_ENABLED_STORAGE_KEY = "grassTouching.hapticsEnabled";
export const DEFAULT_HAPTICS_ENABLED = true;

export function readStoredHapticsEnabled(): boolean {
  const stored = window.localStorage.getItem(HAPTICS_ENABLED_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_HAPTICS_ENABLED;
  }

  return stored !== "false";
}

export function writeStoredHapticsEnabled(enabled: boolean): boolean {
  window.localStorage.setItem(HAPTICS_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
  return enabled;
}
