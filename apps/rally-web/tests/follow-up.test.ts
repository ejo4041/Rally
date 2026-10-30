import test from "node:test";
import assert from "node:assert/strict";
import {
  draftFollowUp,
  whatsappDraftUrl,
  MAX_DRAFT_LENGTH,
} from "../src/follow-up.ts";
import type { Report } from "../src/api.ts";

test("follow-up preserves outcome uncertainty and only includes the host-selected rows", () => {
  const rows: Report["actions"] = [
    {
      text: "Check rollback",
      owner: null,
      dueDate: null,
      status: "proposal",
      evidence: ["private-session:1"],
      followup: "ticket",
      followupPrompt: "Private ticket detail",
    },
  ];
  const draft = draftFollowUp("Release", rows);
  assert.match(draft, /\[Proposal\] Check rollback/);
  assert.match(draft, /Owner: Unresolved · Due: Unresolved/);
  assert.ok(!draft.includes("private-session"));
  assert.ok(!draft.includes("Private ticket detail"));
  assert.ok(!draft.includes("Confirmed"));
  assert.equal(draftFollowUp("Release", []), "");
  assert.match(
    draftFollowUp("Release", [{ ...rows[0], status: "reported_agreement" }]),
    /\[Reported agreement\]/,
  );
  assert.match(
    draftFollowUp("Release", [{ ...rows[0], status: "unresolved" }]),
    /\[Unresolved\]/,
  );
});
test("WhatsApp draft links keep Unicode, newlines and URL-like text inside a bounded text query", () => {
  const text =
    "Review ✓\nOwner: Priya & Alex\nhttps://example.test/?x=1#fragment";
  const url = new URL(whatsappDraftUrl(text)!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("text"), text);
  assert.equal(url.hash, "");
  assert.deepEqual([...url.searchParams.keys()], ["text"]);
  assert.equal(whatsappDraftUrl("   "), null);
  assert.equal(whatsappDraftUrl("x".repeat(MAX_DRAFT_LENGTH + 1)), null);
  assert.ok(whatsappDraftUrl("x".repeat(MAX_DRAFT_LENGTH)));
});
