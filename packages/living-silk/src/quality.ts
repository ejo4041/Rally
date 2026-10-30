export type QualityTier = 'full' | 'balanced' | 'economy';
export type RenderQuality = {
  tier: QualityTier;
  segmentsX: number;
  segmentsY: number;
  dprCap: number;
  dpr: number;
};

const tiers: QualityTier[] = ['full', 'balanced', 'economy'];
const meshes = {
  full: [[128, 24], [192, 40], [320, 64]],
  balanced: [[96, 20], [144, 32], [240, 48]],
  economy: [[64, 16], [112, 24], [160, 40]],
} as const;
const dprCaps: Record<QualityTier, number> = {full: 2, balanced: 1.75, economy: 1.5};

// CSS height and device DPR preserve the existing full-quality physical-pixel LOD.
export function deriveQuality(tier: QualityTier, viewportHeight: number, deviceDpr: number): RenderQuality {
  const nativeDpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? Math.min(2, deviceDpr) : 1;
  const physicalHeight = Math.max(0, Number.isFinite(viewportHeight) ? viewportHeight : 0) * nativeDpr;
  const size = physicalHeight < 180 ? 0 : physicalHeight < 520 ? 1 : 2;
  const [segmentsX, segmentsY] = meshes[tier][size];
  const dprCap = dprCaps[tier];
  return {tier, segmentsX, segmentsY, dprCap, dpr: Math.min(nativeDpr, dprCap)};
}

export type QualitySample = {
  now: number;
  frameMs: number;
  active?: boolean;
  renderMs?: number;
};
export type QualityMetrics = {
  medianFrameMs: number;
  p70FrameMs: number;
  slowFraction: number;
  medianRenderMs?: number;
};
type ReductionTrial = {from: number; baseline: number; measurements: number[]};
const percentile = (values: number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
};

export class AdaptiveQualityController {
  private index = 0;
  constructor(initial: QualityTier = 'full') { this.index = tiers.indexOf(initial); }
  private lastNow: number | null = null;
  private suspended = false;
  private warmUntil = 0;
  private windowStart = 0;
  private frames: number[] = [];
  private renderTimes: number[] = [];
  private slowWindows = 0;
  private healthyWindows = 0;
  private nextReductionAt = 0;
  private nextUpgradeAt = 0;
  private trial: ReductionTrial | null = null;
  private metrics: QualityMetrics | null = null;

  get tier(): QualityTier { return tiers[this.index]; }
  get lastMetrics(): Readonly<QualityMetrics> | null { return this.metrics; }

  // All times are milliseconds. Call after resizing or resuming a visible canvas.
  reset(now: number): QualityTier {
    if (!Number.isFinite(now)) return this.tier;
    if (this.trial) this.index = this.trial.from;
    this.lastNow = now;
    this.warmUntil = now + 1500;
    this.clearWindow(now);
    this.slowWindows = 0;
    this.healthyWindows = 0;
    this.trial = null;
    this.metrics = null;
    this.nextReductionAt = Math.max(this.nextReductionAt, this.warmUntil);
    this.nextUpgradeAt = Math.max(this.nextUpgradeAt, now + 30000);
    return this.tier;
  }

  sample({now, frameMs, active = true, renderMs}: QualitySample): QualityTier {
    if (!Number.isFinite(now)) return this.tier;
    if (!active) {
      this.suspended = true;
      this.clearWindow(now);
      this.lastNow = now;
      return this.tier;
    }
    if (this.lastNow === null || this.suspended || now < this.lastNow || now - this.lastNow > 1500) {
      this.suspended = false;
      return this.reset(now);
    }
    this.lastNow = now;
    if (now < this.warmUntil || !Number.isFinite(frameMs) || frameMs <= 0) return this.tier;
    this.frames.push(Math.min(100, frameMs));
    if (Number.isFinite(renderMs) && renderMs! >= 0) this.renderTimes.push(Math.min(100, renderMs!));
    if (now - this.windowStart < 2000 || this.frames.length < 24) return this.tier;

    const medianFrameMs = percentile(this.frames, .5);
    const p70FrameMs = percentile(this.frames, .7);
    const slowFraction = this.frames.filter(value => value > 23).length / this.frames.length;
    const medianRenderMs = this.renderTimes.length >= this.frames.length * .5 ? percentile(this.renderTimes, .5) : undefined;
    this.metrics = {medianFrameMs, p70FrameMs, slowFraction, medianRenderMs};
    this.clearWindow(now);
    const slow = p70FrameMs > 23 && slowFraction >= .65;
    const healthy = p70FrameMs <= 18.5 && (medianRenderMs === undefined || medianRenderMs <= 10);

    if (this.trial) {
      this.trial.measurements.push(medianFrameMs);
      if (this.trial.measurements.length < 2) return this.tier;
      const measured = percentile(this.trial.measurements, .5);
      const helped = measured <= this.trial.baseline * .88 || measured <= 18.5;
      if (!helped) {
        const prior = this.trial.from;
        this.trial = null;
        this.change(prior, now);
        this.nextReductionAt = now + 60000;
      } else {
        this.trial = null;
        this.slowWindows = 0;
        this.healthyWindows = 0;
        this.nextReductionAt = now + 6000;
        this.nextUpgradeAt = now + 30000;
      }
      return this.tier;
    }

    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    this.healthyWindows = healthy ? this.healthyWindows + 1 : 0;
    if (this.index < 2 && this.slowWindows >= 3 && now >= this.nextReductionAt) {
      const from = this.index;
      this.change(this.index + 1, now);
      this.trial = {from, baseline: medianFrameMs, measurements: []};
    } else if (this.index > 0 && this.healthyWindows >= 5 && now >= this.nextUpgradeAt) {
      this.change(this.index - 1, now);
      this.nextUpgradeAt = now + 45000;
    }
    return this.tier;
  }

  private change(index: number, now: number) {
    this.index = Math.max(0, Math.min(2, index));
    this.warmUntil = now + 1500;
    this.slowWindows = 0;
    this.healthyWindows = 0;
    this.clearWindow(this.warmUntil);
  }

  private clearWindow(now: number) {
    this.windowStart = now;
    this.frames = [];
    this.renderTimes = [];
  }
}
