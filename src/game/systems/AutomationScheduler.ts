const DEFAULT_MAX_DELTA_MS = 250;
const DEFAULT_MAX_JOBS_PER_FRAME = 4;

export interface AutomationJob<TContext> {
  id: string;
  intervalMs: number;
  initialDelayMs?: number;
  run(deltaMs: number, context: TContext): void;
}

interface ScheduledAutomationJob<TContext> extends AutomationJob<TContext> {
  elapsedMs: number;
  runElapsedMs: number;
}

export class AutomationScheduler<TContext> {
  private readonly jobs: ScheduledAutomationJob<TContext>[] = [];

  constructor(
    private readonly maxDeltaMs = DEFAULT_MAX_DELTA_MS,
    private readonly maxJobsPerFrame = DEFAULT_MAX_JOBS_PER_FRAME,
  ) {}

  add(job: AutomationJob<TContext>): void {
    this.jobs.push({
      ...job,
      elapsedMs: -(job.initialDelayMs ?? 0),
      runElapsedMs: 0,
    });
  }

  reset(): void {
    for (const job of this.jobs) {
      job.elapsedMs = -(job.initialDelayMs ?? 0);
      job.runElapsedMs = 0;
    }
  }

  update(deltaMs: number, context: TContext): void {
    if (this.jobs.length === 0 || deltaMs <= 0) {
      return;
    }

    const clampedDelta = Math.min(deltaMs, this.maxDeltaMs);
    for (const job of this.jobs) {
      job.elapsedMs += clampedDelta;
      job.runElapsedMs += clampedDelta;
    }

    let jobsRun = 0;
    for (const job of this.jobs) {
      if (jobsRun >= this.maxJobsPerFrame || job.elapsedMs < job.intervalMs) {
        continue;
      }

      job.elapsedMs %= job.intervalMs;
      const runDelta = job.runElapsedMs;
      job.runElapsedMs = 0;
      job.run(runDelta, context);
      jobsRun += 1;
    }
  }
}
