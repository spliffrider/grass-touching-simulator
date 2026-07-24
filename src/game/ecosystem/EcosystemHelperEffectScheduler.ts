import { HELPER_IDS, type HelperId } from "./EcosystemCatalog";

export const DESKTOP_HELPER_EFFECT_GAP_MS = 120;
export const PHONE_HELPER_EFFECT_GAP_MS = 210;
export const DESKTOP_HELPER_REPEAT_GAP_MS = 620;
export const PHONE_HELPER_REPEAT_GAP_MS = 900;

export interface HelperEffectBatch {
  helperId: HelperId;
  pulseCount: number;
}

export function getHelperEffectGapMs(mobile: boolean): number {
  return mobile ? PHONE_HELPER_EFFECT_GAP_MS : DESKTOP_HELPER_EFFECT_GAP_MS;
}

export function getHelperRepeatGapMs(mobile: boolean): number {
  return mobile ? PHONE_HELPER_REPEAT_GAP_MS : DESKTOP_HELPER_REPEAT_GAP_MS;
}

export class EcosystemHelperEffectScheduler {
  private readonly pendingPulses = new Float64Array(HELPER_IDS.length);
  private readonly nextHelperAtMs = new Float64Array(HELPER_IDS.length);
  private nextGlobalAtMs = 0;
  private cursor = 0;

  enqueue(pulses: Readonly<Record<HelperId, number>>): void {
    for (let index = 0; index < HELPER_IDS.length; index += 1) {
      const pulseCount = pulses[HELPER_IDS[index]];
      if (Number.isFinite(pulseCount) && pulseCount > 0) {
        this.pendingPulses[index] += pulseCount;
      }
    }
  }

  takeNext(nowMs: number, mobile: boolean): HelperEffectBatch | null {
    const safeNowMs = Math.max(0, nowMs);
    if (safeNowMs < this.nextGlobalAtMs) return null;

    for (let offset = 0; offset < HELPER_IDS.length; offset += 1) {
      const index = (this.cursor + offset) % HELPER_IDS.length;
      if (this.pendingPulses[index] <= 0 || safeNowMs < this.nextHelperAtMs[index]) continue;

      const pulseCount = this.pendingPulses[index];
      this.pendingPulses[index] = 0;
      this.nextGlobalAtMs = safeNowMs + getHelperEffectGapMs(mobile);
      this.nextHelperAtMs[index] = safeNowMs + getHelperRepeatGapMs(mobile);
      this.cursor = (index + 1) % HELPER_IDS.length;
      return { helperId: HELPER_IDS[index], pulseCount };
    }

    return null;
  }

  requeue(batch: Readonly<HelperEffectBatch>): void {
    const index = HELPER_IDS.indexOf(batch.helperId);
    if (index >= 0 && Number.isFinite(batch.pulseCount) && batch.pulseCount > 0) {
      this.pendingPulses[index] += batch.pulseCount;
    }
  }

  getPendingPulseCount(): number {
    let total = 0;
    for (let index = 0; index < this.pendingPulses.length; index += 1) {
      total += this.pendingPulses[index];
    }
    return total;
  }

  clear(nowMs = 0): void {
    this.pendingPulses.fill(0);
    this.nextHelperAtMs.fill(0);
    this.nextGlobalAtMs = Math.max(0, nowMs);
    this.cursor = 0;
  }
}
