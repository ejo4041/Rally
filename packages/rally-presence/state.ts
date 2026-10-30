export const axes = [
  "joy",
  "curiosity",
  "worry",
  "irritation",
  "sadness",
  "confidence",
  "energy",
  "sass",
] as const;
export type Axis = (typeof axes)[number];
export type Forces = Record<Axis, number | null>;
export type Channel = {
  value: number;
  velocity: number;
  anchor: number;
  target: number;
  force: number;
  at: number;
  expires: number;
  omega: number;
};
export type Presence = {
  revision: number;
  evidenceKey: string;
  /** Evidence revisions are consumed once, even when cited in a different group. */
  consumed?: string[];
  rejected?: Axis[];
  channels: Record<Axis, Channel>;
};
const clamp = (x: number, a = 0, b = 100) => Math.min(b, Math.max(a, x));
export function initialPresence(now: number): Presence {
  const baseline = [30, 20, 0, 0, 0, 55, 40, 0];
  return {
    revision: 0,
    evidenceKey: "",
    consumed: [],
    rejected: [],
    channels: Object.fromEntries(
      axes.map((key, i) => [
        key,
        {
          value: baseline[i],
          velocity: 0,
          anchor: baseline[i],
          target: baseline[i],
          force: 0,
          at: now,
          expires: now,
          omega: 1,
        },
      ]),
    ) as Record<Axis, Channel>,
  };
}
/** Exact critical damping: the result does not depend on frame rate or sampling. */
export function evaluate(c: Channel, now: number): Channel {
  const t = Math.max(0, (Math.min(now, c.expires) - c.at) / 1000);
  const d = c.value - c.target,
    j = c.velocity + c.omega * d,
    e = Math.exp(-c.omega * t);
  return {
    ...c,
    value: clamp(c.target + (d + j * t) * e),
    velocity: now >= c.expires ? 0 : (c.velocity - c.omega * j * t) * e,
    at: Math.max(c.at, now),
  };
}
export function hold(previous: Presence, now: number): Presence {
  return {
    ...previous,
    revision: previous.revision + 1,
    channels: Object.fromEntries(
      axes.map((axis) => {
        const c = evaluate(previous.channels[axis], now);
        return [
          axis,
          {
            ...c,
            velocity: 0,
            target: c.value,
            anchor: c.value,
            force: 0,
            expires: now,
          },
        ];
      }),
    ) as Record<Axis, Channel>,
  };
}
export function actuate(
  previous: Presence,
  forces: Forces,
  evidenceKey: string,
  now: number,
): Presence {
  const citations = evidenceKey.split("|").filter(Boolean);
  const consumed = new Set(
    previous.consumed ?? previous.evidenceKey.split("|").filter(Boolean),
  );
  if (!citations.some((key) => !consumed.has(key))) return previous;
  const next = structuredClone(previous);
  next.revision++;
  next.evidenceKey = evidenceKey;
  next.consumed = [...new Set([...consumed, ...citations])];
  next.rejected = [];
  for (const axis of axes) {
    const u = forces[axis];
    if (u === null) continue;
    if (!Number.isFinite(u) || Math.abs(u) > 1)
      throw new Error("Invalid emotion force");
    const old = previous.channels[axis],
      c = evaluate(old, now);
    if (u === 0) {
      next.channels[axis] = {
        ...c,
        velocity: 0,
        target: c.value,
        anchor: c.value,
        force: 0,
        expires: now,
      };
      continue;
    }
    const anchor =
      old.force === 0 || Math.sign(old.force) !== Math.sign(u)
        ? c.value
        : old.anchor;
    const target = clamp(anchor + 100 * u),
      delta = target - c.value;
    if (Math.abs(delta) > 1e-6 && Math.sign(delta) !== Math.sign(u)) {
      next.rejected.push(axis);
      continue;
    }
    const omega = 4.744 / (8 - 7.2 * Math.abs(u));
    const velocity =
      Math.sign(delta) *
      clamp(
        Math.sign(delta) * c.velocity,
        0,
        Math.min(220, omega * Math.abs(delta)),
      );
    next.channels[axis] = {
      ...c,
      anchor,
      target,
      force: u,
      omega,
      velocity,
      expires: now + 10000,
    };
  }
  return next;
}
export function values(state: Presence, now: number): Record<Axis, number> {
  return Object.fromEntries(
    axes.map((a) => [a, evaluate(state.channels[a], now).value / 100]),
  ) as Record<Axis, number>;
}
/** Compact rendering contract excludes the evidence ledger. */
export function trajectory(state: Presence): Presence {
  return {
    revision: state.revision,
    evidenceKey: "",
    channels: state.channels,
  };
}
