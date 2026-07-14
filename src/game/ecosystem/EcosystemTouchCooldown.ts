export const MANUAL_TOUCH_COOLDOWN_MS = 380;
export const MAX_TRACKED_TOUCH_COOLDOWNS = 64;
const MANUAL_TOUCH_COOLDOWN_REDUCTION_PER_RANK_MS = 24;
const MIN_MANUAL_TOUCH_COOLDOWN_MS = 140;

export interface TouchCooldownAttempt {
  accepted: boolean;
  readyAtMs: number;
  remainingMs: number;
}

export function getManualTouchCooldownMs(recoveryRank = 0): number {
  const safeRank = Math.max(0, Math.min(10, Math.floor(recoveryRank)));
  return Math.max(
    MIN_MANUAL_TOUCH_COOLDOWN_MS,
    MANUAL_TOUCH_COOLDOWN_MS - safeRank * MANUAL_TOUCH_COOLDOWN_REDUCTION_PER_RANK_MS,
  );
}

export function tryStartTouchCooldown(
  cooldowns: Map<number, number>,
  tileIndex: number,
  nowMs: number,
  cooldownMs = MANUAL_TOUCH_COOLDOWN_MS,
): TouchCooldownAttempt {
  const currentReadyAt = cooldowns.get(tileIndex);
  if (currentReadyAt !== undefined && currentReadyAt > nowMs) {
    return {
      accepted: false,
      readyAtMs: currentReadyAt,
      remainingMs: currentReadyAt - nowMs,
    };
  }

  if (cooldowns.size >= MAX_TRACKED_TOUCH_COOLDOWNS) {
    pruneTouchCooldowns(cooldowns, nowMs);
  }
  if (cooldowns.size >= MAX_TRACKED_TOUCH_COOLDOWNS) {
    let earliestTile = -1;
    let earliestReadyAt = Number.POSITIVE_INFINITY;
    for (const [trackedTile, readyAt] of cooldowns) {
      if (readyAt < earliestReadyAt) {
        earliestTile = trackedTile;
        earliestReadyAt = readyAt;
      }
    }
    if (earliestTile >= 0) cooldowns.delete(earliestTile);
  }

  const safeCooldownMs = Math.max(0, cooldownMs);
  const readyAtMs = nowMs + safeCooldownMs;
  cooldowns.set(tileIndex, readyAtMs);
  return { accepted: true, readyAtMs, remainingMs: safeCooldownMs };
}

export function pruneTouchCooldowns(cooldowns: Map<number, number>, nowMs: number): void {
  for (const [tileIndex, readyAtMs] of cooldowns) {
    if (readyAtMs <= nowMs) cooldowns.delete(tileIndex);
  }
}

export function getTouchCooldownProgress(startedAtMs: number, readyAtMs: number, nowMs: number): number {
  const durationMs = readyAtMs - startedAtMs;
  if (durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, (nowMs - startedAtMs) / durationMs));
}
