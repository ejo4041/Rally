# Loading feedback, Meta attribution and visible Rally responses

Implemented on droplet `/srv/hackathon/rally-feedback`, branch `feedback/demo-polish-20261030` after feedback release d5d2399. No model/backend behavior or provider routing changes.

Promise-returning button/form actions show a CSS spinner, aria-busy and meaningful pending label; repeated activation is blocked until settlement. Existing action handlers retain error messages and control-disable logic. Finally cleanup restores the label unless polling already updated it for the current phase. Reduced-motion users get a static visible wait indicator. Preparation, retry analysis, Ask Rally, audio connection, End, PDF, report grants/views, login/MFA, admin forms, usage and history loading are covered. Long-running background report generation has a separate spinner that survives the initiating HTTP request. Stop/cancel controls remain available. Wait indicators do not imply progress percentages or successful completion.

Home highlights actual Meta roles. Context labels identify Muse Spark1.3 in agenda planning/live guidance/reporting and Muse Voice Transcribe for transcription. Voice attribution distinguishes SeamlessM4T streaming from the local MMS option; it does not promise each model is active simultaneously. Labels are descriptive text, not copied official logos or unsupported additional integrations.

Conversation includes a clearly separated Rally response log, also in the mobile transcript sheet. Only approved persisted interventions appear; transient approved events update immediately, deduplicate by response id, and survive an older HTTP snapshot. Responses are not inserted into participant turns or report evidence. Historical generated response text remains visible after End/reload. Latest matching voice status distinguishes preparing/speaking/completed/canceled/failed. Older responses have no invented playback outcome. A visible note explains that generated text and local audio output do not confirm remote reception; cancellation may leave unspoken text visible.

Validation:17 frontend tests pass, including retained responses across stale refresh, deduplication, stale-event rejection, escaped response text and conservative playback labeling. Typecheck/build pass. Browser workflow passes with synthetic providers, including gated delayed preparation/PDF, failed prepare followed by retry, duplicate submit suppression, actual PDF/sharing/revocation and visible Rally text separate from participant transcript. Security browser regression passes. No paid model calls or platform joins. Actual Bitwarden extension and remote Teams acceptance remain manual checks inherited from previous release.

Deployment evidence is recorded in research/loading-replies-deployed.json when finalized. Existing narrated video is an earlier review draft; it has not been rerecorded for these UI additions. No upload/submission.

## Deployed

Static assets `7f2a634` are active at https://rally.tail703f9e.ts.net/. Physical-path staging completed and built assets matched the tested worktree before switching. API source is byte-identical to d5d2399 and its process/media were not restarted; existing call/report work was preserved. SQLite backup `/srv/hackathon/rally-deployed/backups/ui-feedback-20261030T224459Z.sqlite`.

Public browser probe passed real MFA/secure cookie/closed signup, Meta model cards, gated spinner/duplicate-submit/failure cleanup, persisted synthetic Rally response with cancellation state, actual PDF and account grant/denial/revoke. Synthetic accounts/records removed. Preparation was intercepted in the browser (no model request); no paid calls/platform joins by these checks. The earlier video stays a review draft of the preceding UI.
