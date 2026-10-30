import type { Meeting } from "./contracts.ts";

// Older reports appended corrections to the summary without author metadata.
// Retain those exact segments as legacy text rather than dropping them on retry.
export function retainLegacyNotes(m: {
  report: { summary: string } | null;
  reportNotes?: Meeting["reportNotes"];
}) {
  if (m.reportNotes !== undefined) return;
  m.reportNotes = (
    m.report?.summary.split("\nHost correction: ").slice(1) || []
  ).map((text) => ({ at: null, text, legacy: true as const }));
}
