export interface RootMotionProfile {
  phase: number;
  breathSpeed: number;
  breathAmount: number;
  swaySpeed: number;
  swayAmount: number;
  bobSpeed: number;
  bobAmount: number;
  tiltSpeed: number;
  tiltAmount: number;
  sparkSpeedX: number;
  sparkSpeedY: number;
}

function seededUnit(rootId: number, salt: number): number {
  let value = Math.imul((Math.max(0, Math.floor(rootId)) + 1) ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

function ranged(rootId: number, salt: number, min: number, max: number): number {
  return min + seededUnit(rootId, salt) * (max - min);
}

export function createRootMotionProfile(rootId: number): RootMotionProfile {
  return {
    phase: ranged(rootId, 11, 0, Math.PI * 2),
    breathSpeed: ranged(rootId, 23, 1.72, 2.58),
    breathAmount: ranged(rootId, 31, 0.014, 0.03),
    swaySpeed: ranged(rootId, 47, 0.86, 1.62),
    swayAmount: ranged(rootId, 59, 0.72, 1.72),
    bobSpeed: ranged(rootId, 71, 1.12, 2.08),
    bobAmount: ranged(rootId, 83, 0.42, 1.08),
    tiltSpeed: ranged(rootId, 97, 0.72, 1.38),
    tiltAmount: ranged(rootId, 109, 0.48, 1.12),
    sparkSpeedX: ranged(rootId, 127, 1.34, 2.16),
    sparkSpeedY: ranged(rootId, 139, 1.16, 2.04),
  };
}
