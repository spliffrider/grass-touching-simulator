const HEALTH_FOLLOW_MS = 110;
const HEALTH_HEARTBEAT_SLOW_MS = 1_180;
const HEALTH_HEARTBEAT_FAST_MS = 500;

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function heartbeatPeak(phase: number, center: number, width: number): number {
  const distance = (phase - center) / width;
  return Math.exp(-(distance * distance));
}

export function smoothHealthRatio(current: number, target: number, deltaMs: number): number {
  const safeCurrent = clampRatio(current);
  const safeTarget = clampRatio(target);
  if (deltaMs <= 0) return safeTarget;
  const blend = 1 - Math.exp(-Math.min(deltaMs, 250) / HEALTH_FOLLOW_MS);
  return safeCurrent + (safeTarget - safeCurrent) * blend;
}

export function predictHealthRatio(
  hp: number,
  maxHp: number,
  hpDeltaPerSecond: number,
  pendingMs: number,
  maxPendingMs: number,
): number {
  const safeMaxHp = Math.max(1, Number.isFinite(maxHp) ? maxHp : 1);
  const safeHp = Number.isFinite(hp) ? hp : 0;
  const safeRate = Number.isFinite(hpDeltaPerSecond) ? hpDeltaPerSecond : 0;
  const predictionMs = Math.max(0, Math.min(
    Number.isFinite(pendingMs) ? pendingMs : 0,
    Math.max(0, Number.isFinite(maxPendingMs) ? maxPendingMs : 0),
  ));
  return clampRatio((safeHp + safeRate * predictionMs / 1_000) / safeMaxHp);
}

export function getHealthHeartbeatCycleMs(healthRatio: number): number {
  const urgency = Math.pow(1 - clampRatio(healthRatio), 1.25);
  return HEALTH_HEARTBEAT_SLOW_MS - (HEALTH_HEARTBEAT_SLOW_MS - HEALTH_HEARTBEAT_FAST_MS) * urgency;
}

export function getHealthHeartbeatPulse(timeMs: number, healthRatio: number): number {
  const cycleMs = getHealthHeartbeatCycleMs(healthRatio);
  const phase = ((timeMs % cycleMs) + cycleMs) % cycleMs / cycleMs;
  const firstBeat = heartbeatPeak(phase, 0.08, 0.032);
  const secondBeat = heartbeatPeak(phase, 0.22, 0.042) * 0.58;
  return Math.min(1, firstBeat + secondBeat);
}
