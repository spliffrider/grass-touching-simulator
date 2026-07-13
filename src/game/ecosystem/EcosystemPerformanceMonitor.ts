const FRAME_BUCKET_MS = 0.25;
const MAX_BUCKET_MS = 100;
const FRAME_BUCKET_COUNT = Math.floor(MAX_BUCKET_MS / FRAME_BUCKET_MS) + 1;

export interface EcosystemPerformanceSnapshot {
  windowMs: number;
  frames: number;
  fps: number;
  averageFrameDeltaMs: number;
  p95FrameDeltaMs: number;
  maxFrameDeltaMs: number;
  averageFrameWorkMs: number;
  maxFrameWorkMs: number;
  averageSimulationMs: number;
  maxSimulationMs: number;
  averageAnimationMs: number;
  maxAnimationMs: number;
  uiRefreshes: number;
  averageUiRefreshMs: number;
  maxUiRefreshMs: number;
  fieldRenders: number;
  averageFieldRenderMs: number;
  maxFieldRenderMs: number;
  saves: number;
  averageSaveMs: number;
  maxSaveMs: number;
  touchActions: number;
  averageTouchActionMs: number;
  maxTouchActionMs: number;
  averageTouchModelMs: number;
  averageTouchAudioMs: number;
  averageTouchEffectsMs: number;
  averageTouchRenderMs: number;
  averageTouchUiMs: number;
}

const EMPTY_SNAPSHOT: EcosystemPerformanceSnapshot = {
  windowMs: 0,
  frames: 0,
  fps: 0,
  averageFrameDeltaMs: 0,
  p95FrameDeltaMs: 0,
  maxFrameDeltaMs: 0,
  averageFrameWorkMs: 0,
  maxFrameWorkMs: 0,
  averageSimulationMs: 0,
  maxSimulationMs: 0,
  averageAnimationMs: 0,
  maxAnimationMs: 0,
  uiRefreshes: 0,
  averageUiRefreshMs: 0,
  maxUiRefreshMs: 0,
  fieldRenders: 0,
  averageFieldRenderMs: 0,
  maxFieldRenderMs: 0,
  saves: 0,
  averageSaveMs: 0,
  maxSaveMs: 0,
  touchActions: 0,
  averageTouchActionMs: 0,
  maxTouchActionMs: 0,
  averageTouchModelMs: 0,
  averageTouchAudioMs: 0,
  averageTouchEffectsMs: 0,
  averageTouchRenderMs: 0,
  averageTouchUiMs: 0,
};

export class EcosystemPerformanceMonitor {
  private readonly frameDeltaBuckets = new Uint16Array(FRAME_BUCKET_COUNT);
  private snapshot: EcosystemPerformanceSnapshot = { ...EMPTY_SNAPSHOT };
  private elapsedMs = 0;
  private frames = 0;
  private frameDeltaTotalMs = 0;
  private maxFrameDeltaMs = 0;
  private frameWorkTotalMs = 0;
  private maxFrameWorkMs = 0;
  private simulationTotalMs = 0;
  private maxSimulationMs = 0;
  private animationTotalMs = 0;
  private maxAnimationMs = 0;
  private uiRefreshes = 0;
  private uiRefreshTotalMs = 0;
  private maxUiRefreshMs = 0;
  private fieldRenders = 0;
  private fieldRenderTotalMs = 0;
  private maxFieldRenderMs = 0;
  private saves = 0;
  private saveTotalMs = 0;
  private maxSaveMs = 0;
  private touchActions = 0;
  private touchActionTotalMs = 0;
  private maxTouchActionMs = 0;
  private touchModelTotalMs = 0;
  private touchAudioTotalMs = 0;
  private touchEffectsTotalMs = 0;
  private touchRenderTotalMs = 0;
  private touchUiTotalMs = 0;

  constructor(private readonly sampleWindowMs = 1_000) {}

  recordFrame(
    deltaMs: number,
    frameWorkMs: number,
    simulationMs: number,
    animationMs: number,
    uiRefreshMs = -1,
    fieldRenderMs = -1,
    saveMs = -1,
  ): void {
    const safeDeltaMs = Math.max(0, deltaMs);
    this.elapsedMs += safeDeltaMs;
    this.frames += 1;
    this.frameDeltaTotalMs += safeDeltaMs;
    this.maxFrameDeltaMs = Math.max(this.maxFrameDeltaMs, safeDeltaMs);
    const bucketIndex = Math.min(
      FRAME_BUCKET_COUNT - 1,
      Math.floor(safeDeltaMs / FRAME_BUCKET_MS),
    );
    this.frameDeltaBuckets[bucketIndex] += 1;

    this.frameWorkTotalMs += frameWorkMs;
    this.maxFrameWorkMs = Math.max(this.maxFrameWorkMs, frameWorkMs);
    this.simulationTotalMs += simulationMs;
    this.maxSimulationMs = Math.max(this.maxSimulationMs, simulationMs);
    this.animationTotalMs += animationMs;
    this.maxAnimationMs = Math.max(this.maxAnimationMs, animationMs);

    if (uiRefreshMs >= 0) {
      this.uiRefreshes += 1;
      this.uiRefreshTotalMs += uiRefreshMs;
      this.maxUiRefreshMs = Math.max(this.maxUiRefreshMs, uiRefreshMs);
    }
    if (fieldRenderMs >= 0) {
      this.fieldRenders += 1;
      this.fieldRenderTotalMs += fieldRenderMs;
      this.maxFieldRenderMs = Math.max(this.maxFieldRenderMs, fieldRenderMs);
    }
    if (saveMs >= 0) {
      this.saves += 1;
      this.saveTotalMs += saveMs;
      this.maxSaveMs = Math.max(this.maxSaveMs, saveMs);
    }

    if (this.elapsedMs >= this.sampleWindowMs) this.closeWindow();
  }

  getSnapshot(): Readonly<EcosystemPerformanceSnapshot> {
    return this.snapshot;
  }

  recordTouchAction(
    durationMs: number,
    modelMs = 0,
    audioMs = 0,
    effectsMs = 0,
    renderMs = 0,
    uiMs = 0,
  ): void {
    this.touchActions += 1;
    this.touchActionTotalMs += durationMs;
    this.maxTouchActionMs = Math.max(this.maxTouchActionMs, durationMs);
    this.touchModelTotalMs += modelMs;
    this.touchAudioTotalMs += audioMs;
    this.touchEffectsTotalMs += effectsMs;
    this.touchRenderTotalMs += renderMs;
    this.touchUiTotalMs += uiMs;
  }

  private closeWindow(): void {
    const percentileTarget = Math.max(1, Math.ceil(this.frames * 0.95));
    let samples = 0;
    let p95FrameDeltaMs = 0;
    for (let index = 0; index < this.frameDeltaBuckets.length; index += 1) {
      samples += this.frameDeltaBuckets[index];
      if (samples >= percentileTarget) {
        p95FrameDeltaMs = index * FRAME_BUCKET_MS;
        break;
      }
    }

    this.snapshot = {
      windowMs: this.elapsedMs,
      frames: this.frames,
      fps: this.elapsedMs > 0 ? this.frames * 1_000 / this.elapsedMs : 0,
      averageFrameDeltaMs: this.frames > 0 ? this.frameDeltaTotalMs / this.frames : 0,
      p95FrameDeltaMs,
      maxFrameDeltaMs: this.maxFrameDeltaMs,
      averageFrameWorkMs: this.frames > 0 ? this.frameWorkTotalMs / this.frames : 0,
      maxFrameWorkMs: this.maxFrameWorkMs,
      averageSimulationMs: this.frames > 0 ? this.simulationTotalMs / this.frames : 0,
      maxSimulationMs: this.maxSimulationMs,
      averageAnimationMs: this.frames > 0 ? this.animationTotalMs / this.frames : 0,
      maxAnimationMs: this.maxAnimationMs,
      uiRefreshes: this.uiRefreshes,
      averageUiRefreshMs: this.uiRefreshes > 0 ? this.uiRefreshTotalMs / this.uiRefreshes : 0,
      maxUiRefreshMs: this.maxUiRefreshMs,
      fieldRenders: this.fieldRenders,
      averageFieldRenderMs: this.fieldRenders > 0 ? this.fieldRenderTotalMs / this.fieldRenders : 0,
      maxFieldRenderMs: this.maxFieldRenderMs,
      saves: this.saves,
      averageSaveMs: this.saves > 0 ? this.saveTotalMs / this.saves : 0,
      maxSaveMs: this.maxSaveMs,
      touchActions: this.touchActions,
      averageTouchActionMs: this.touchActions > 0 ? this.touchActionTotalMs / this.touchActions : 0,
      maxTouchActionMs: this.maxTouchActionMs,
      averageTouchModelMs: this.touchActions > 0 ? this.touchModelTotalMs / this.touchActions : 0,
      averageTouchAudioMs: this.touchActions > 0 ? this.touchAudioTotalMs / this.touchActions : 0,
      averageTouchEffectsMs: this.touchActions > 0 ? this.touchEffectsTotalMs / this.touchActions : 0,
      averageTouchRenderMs: this.touchActions > 0 ? this.touchRenderTotalMs / this.touchActions : 0,
      averageTouchUiMs: this.touchActions > 0 ? this.touchUiTotalMs / this.touchActions : 0,
    };

    this.elapsedMs = 0;
    this.frames = 0;
    this.frameDeltaTotalMs = 0;
    this.maxFrameDeltaMs = 0;
    this.frameWorkTotalMs = 0;
    this.maxFrameWorkMs = 0;
    this.simulationTotalMs = 0;
    this.maxSimulationMs = 0;
    this.animationTotalMs = 0;
    this.maxAnimationMs = 0;
    this.uiRefreshes = 0;
    this.uiRefreshTotalMs = 0;
    this.maxUiRefreshMs = 0;
    this.fieldRenders = 0;
    this.fieldRenderTotalMs = 0;
    this.maxFieldRenderMs = 0;
    this.saves = 0;
    this.saveTotalMs = 0;
    this.maxSaveMs = 0;
    this.touchActions = 0;
    this.touchActionTotalMs = 0;
    this.maxTouchActionMs = 0;
    this.touchModelTotalMs = 0;
    this.touchAudioTotalMs = 0;
    this.touchEffectsTotalMs = 0;
    this.touchRenderTotalMs = 0;
    this.touchUiTotalMs = 0;
    this.frameDeltaBuckets.fill(0);
  }
}
