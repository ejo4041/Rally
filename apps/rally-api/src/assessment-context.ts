import {
  axes,
  evaluate,
  initialPresence,
} from "../../../packages/rally-presence/state.ts";
import type { Snapshot, Turn } from "./contracts.ts";

export function recentTurns(turns: Turn[]): Turn[] {
  let remaining = 12000;
  const selected: Turn[] = [];
  for (const turn of turns.slice(-40).reverse()) {
    if (turn.text.length > remaining) break; // Never silently truncate cited evidence.
    selected.unshift(turn);
    remaining -= turn.text.length;
  }
  return selected;
}
export function assessmentContext(snapshot: Snapshot, now = Date.now()) {
  const m = snapshot.meeting,
    state = m.presence ?? initialPresence(now);
  return {
    meeting: {
      title: m.title,
      plan: m.plan,
      startedAt: m.startedAt,
      originalDeadline:
        m.startedAt === null ? null : m.startedAt + m.durationMinutes * 60000,
      epoch: m.epoch,
      progress: m.progress.slice(0, 2000),
      concerns: m.concerns ?? [],
      focus: m.assessment?.focus ?? null,
      emotions: Object.fromEntries(
        axes.map((a) => {
          const channel = evaluate(state.channels[a], now);
          const positiveAnchor =
            channel.force > 0 ? channel.anchor : channel.value;
          const negativeAnchor =
            channel.force < 0 ? channel.anchor : channel.value;
          return [
            a,
            {
              value: channel.value,
              target: channel.target,
              force: channel.force,
              anchor: channel.anchor,
              positiveMinimum: Math.max(
                0,
                (channel.value - positiveAnchor) / 100,
              ),
              negativeMaximum: Math.min(
                0,
                (channel.value - negativeAnchor) / 100,
              ),
              decreaseToZero: -negativeAnchor / 100,
              increaseTo100: (100 - positiveAnchor) / 100,
            },
          ];
        }),
      ),
      rejectedEmotionCommands: state.rejected ?? [],
      latestInterventions: m.interventions.slice(-2),
      playback: m.playback ?? null,
      gaps: m.gaps.slice(-3),
      audioExclusions: m.audioExclusions?.slice(-3) ?? [],
    },
    elapsedSeconds: snapshot.elapsedSeconds,
    turns: recentTurns(snapshot.turns),
  };
}
