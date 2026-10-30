import test from "node:test";
import assert from "node:assert/strict";
import { retainLegacyNotes } from "../src/report-notes.ts";
import type { Meeting } from "../src/contracts.ts";

test("legacy appended corrections survive structured-note migration once, without invented timestamps", () => {
  const m: {
    report: { summary: string };
    reportNotes?: Meeting["reportNotes"];
  } = {
    report: {
      summary:
        "Model summary\nHost correction: Original owner corrected\nHost correction: Preserve this\nmultiline detail",
    },
  };
  retainLegacyNotes(m);
  assert.deepEqual(m.reportNotes, [
    { at: null, text: "Original owner corrected", legacy: true },
    { at: null, text: "Preserve this\nmultiline detail", legacy: true },
  ]);
  m.reportNotes!.push({ at: 123, text: "New note" });
  retainLegacyNotes(m);
  assert.equal(m.reportNotes!.length, 3);
});
