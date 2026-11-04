# Judge-style review — November 3, 2026

## Verdict and scope

Rally is a credible, technically substantial hackathon entry with a useful problem and substantive Meta integration. It is not yet a submission-ready entry, and a polished interface alone does not make it a clear favorite. The strongest story is an agenda-aware facilitator that resolves ambiguity while people can still respond, then preserves evidence. Generic meeting transcription/summaries are a crowded category.

Reviewed origin/main at2d681f1: current README, capabilities, own-key setup, source-release records, component notices, Meta provider/speech code, moderation prompts/lifecycle, sample isolation/provenance and recorded validation. The current three-minute edit's existing provenance/transcript informed this review; no fresh full viewing/listening of version06 was performed. No video, product, deployment, repository visibility or attribution was changed. No paid model calls or participant meetings were run. This is a judge-style assessment, not organizer clearance, a legal opinion, an exhaustive security audit or a prediction based on the actual entrant field.

## Rules and evidence hierarchy

The rules are present in [the supplied participant guide](hackathon-participant-guide.md), especially sections4,7,8and9. [The saved organizer-FAQ audit](research/submission-requirements-meta-audit-2026-10-29.md) records the specific supplied approval of self-hosted Meta MMS and exclusion of third-party TTS models. That FAQ excerpt has no independently verified permalink/date; preserve that distinction.

The public [event overview](https://events.cerebralvalley.ai/e/meta-ai-developer-hackathon) confirms the themes, tracks and November4,9PMET submission deadline. The details page exposed only a loading shell and the waiver was inaccessible through the browser reader in this review. The full scoring/public-source/original-work requirements below are therefore grounded in the user-supplied guide, not claimed as independently reverified waiver text. No need for the user to repaste the stored guide; a newer organizer clarification would supersede it where applicable.

## Eligibility and submission risks

| Finding | Basis | Assessment / required action |
| --- | --- | --- |
| GitHub is private; anonymous request returned404 again | Guide§4and§7 require public source | Intentional for now, but fails the documented access requirement if unchanged at submission. Owner should publish only after final rights/privacy review, then verify signed out. Visibility was not changed. |
| Application license absent; Living Silk redistribution record unresolved | Root LICENSE absent; component notices and source-release-readiness.md; guide§4 rights requirement | Missing records are a real release risk, not proof of unauthorized use. Confirm source/artwork rights and select an application license for original code. An explicit MIT/Apache choice is not itself stated as a particular mandatory event license. A public repo alone does not resolve redistribution rights. |
| Human contributors and original work need truthful final confirmation | Guide§4and§7; submission drafts | Software commit identities and shared sessions do not establish human authorship. List actual contributors where required, distinguish testers/feedback/AI assistance and preserve third-party attribution. Do not claim sole human authorship without resolving the facts. No named additional developer was established by the prior repo-name scan. |
| Final video URL/access not established in the repo | Guide§7 requires a three-minute demo | A180-second local file exists, but a local export is not an accessible submission link. Obtain approval, upload/verify the actual final link and make supplied footage rights/consent clear. This review did not modify/upload the video. |
| Meta requirement appears substantively satisfied | Active muse.ts calls Meta chat/realtime-ASR; speech adapters identify Meta models | Reasoning, ASR and voice have real implemented roles. The active-source scan found no known third-party TTS/browser-voice path in current Node app sources; that is a bounded scan, not a full transitive audit. Historical experiments must not be represented as current runtime. |
| No basis found for banning Codex, AWS, LiveKit or Teams as tools/infrastructure | Reviewed guide and saved FAQ | The specific restriction concerns third-party TTS models; do not broaden it into an unsupported all-non-Meta-infrastructure ban. Do not claim Muse Code was used unless it actually was. |
| Bonus-award claims need care | Guide§9 | The named open-weight bonus targets Muse Glimmer or Muse Spark Open; using MMS/Seamless alone does not establish that eligibility. The creative-model bonus names Muse Image/Wonder; the mascot is not vision-model inference. Best Agentic Use-Case is a more plausible fit, but eligibility/winning is not assured. |

The natural theme is **Build for Your World**. Indie versus Startup must match actual entrant/team/business circumstances; company affiliation or a software commit label alone cannot settle that choice. The guide's maximum team size is4.

MMS English and SeamlessM4T-v2-large model cards identify **CC BY-NC4.0** weights: [MMS](https://huggingface.co/facebook/mms-tts-eng), [Seamless](https://huggingface.co/facebook/seamless-m4t-v2-large). Organizer allowance for the event is distinct from permission for a later paid product. Do not assume the current voice stack is commercially cleared. Retain license/provenance facts and resolve commercial use before selling it.

## Judge gotchas

1. **Reproduction is weaker than the README's polish.** The portable Python sample is genuinely runnable without dependencies. Full API fresh installation remains unverified: required Nexus mirror unresolved on the droplet, an offline tarball missing, backend checks used existing dependencies. A judge's own API key alone does not provision speech or Teams. Fix the supported fresh-install path and record one clean-machine run rather than describing cached-host tests as a fresh install. No package needs to be published to Nexus to run Rally from source.
2. **Speech/Teams depend on bespoke infrastructure.** seamless.ts defaults to a specific hosted endpoint; local speech defaults contain /srv/hackathon paths; Teams requires Linux browser/virtual media. Default configuration errors must be clear, endpoint/model paths configurable, and the baseline browser path demonstrably independent of the maintainer's credentials. A model-aware health/readiness view should distinguish API alive, model access, media ready and voice unavailable.
3. **The no-auth experience proves workflow, not live intelligence.** Demo text, responses, reports, scores and sharing are fictional/scripted and are properly labeled. Keep those labels. Judges need the real evidence separately; do not describe demo playback as live ASR/inference.
4. **A citation is not proof of semantic correctness.** Valid source IDs/offsets and finalized-turn handling are substantial engineering. A report claim can still overstate what its cited speech establishes. Show a proposal versus accepted commitment and preserve missing owners/deadlines. Supply a small human-labeled evaluation of that distinction.
5. **Behavior must beat the nagging-bot perception.** Current prompts explicitly prioritize a fresh addressed request, avoid canned redirects, distinguish useful tangents and preserve host pause/override. Source intent is not an acceptance test. Measure unwanted/repeated interruptions and show silence when intervention is not useful. Rehearse a direct “Hey Rally” question, host pause and an owner/deadline correction.
6. **Source, deployment and evidence revisions differ.** Recorded165API+26web unit passes,65-minute real-provider/local-LiveKit endurance and physical Teams recordings support different claims. The65-minute run used synthetic speech and was not a65-minute human Teams test. Documentation checks passed in this review; the full provider/browser/unit matrix was not rerun here.
7. **Availability can bite autonomous evaluation.** Recorded voice service hours are07:00–19:00America/New_York; do not promise24/7 real speech. The static sample remains the safe no-credential path. In the Linux screenshot capture the visual renderer used a text fallback; verify the normal judge browser renders the mascot while keeping a readable fallback.
8. **Submission copy is stale in places.** The older submission-field-draft still describes MMS video narration, pending real-footage slots and private-account judge access. Current video uses human narration and recorded real footage; no-auth evaluation is /demo.html. Consolidate final form answers against the authoritative local working draft before submission, not these old statements.

## Competitive assessment

These are competing products, not verified hackathon entrants. Read AI already advertises real-time transcription, summaries, coaching and meeting metrics: [Read's own feature page](https://www.read.ai/meeting-tools). JoinIn Pulse advertises meeting participation, objective tracking and controlled spoken autonomy: [Pulse's own product page](https://joinin.ai/pulse/). These are vendor claims, not an independently tested head-to-head benchmark.

Therefore “other assistants only summarize afterward” and “we are the first assistant that speaks” are weak or unsupported positioning. A more defensible pitch is: **Rally makes ambiguous decisions and commitments explicit before the meeting ends—and lets people inspect the evidence.** Prove that narrow advantage rather than claiming a whole category is absent.

## Provisional rubric score

Assumes access/rights/attribution gates are resolved. Scores are this reviewer's subjective estimate, not measurements or probability of placing. Demo score is provisional because version06 was not freshly screened in full.

| Category | Weight | Indicative score /10 | Reason |
| --- | --- | --- | --- |
| Impact |30%|7|Recognizable problem, but no credible pilot outcome data or demonstrated switching reason yet |
| Meta tooling |25%|8.5|Integrated planning/listening/guidance/report/voice rather than a decorative model call |
| Technical depth/execution |20%|7.5|Substantial lifecycle/evidence/control/testing work; clean reproduction and bespoke media remain gaps |
| Demo |25%|7|Polished UI and real footage exist; strongest decision-changing moment and final evaluator access still need proof |

Weighted estimate: **74.75/100, approximately75**. That is a credible entrant with a plausible finalist story after tightening, not evidence of a likely win. The actual entry count/quality and judges' preferences are unknown; no responsible numeric win probability is available. The public event's applicant cap is not the number of submitted or competitive projects.

## Highest-value improvements, in order

1. **Finish eligibility/access before adding features.** Resolve rights/license and contributor facts; reconcile stale submission copy; verify the final public source/video when authorized. Keep the repo private until the owner requests the visibility change.
2. **Prove the supported fresh-machine path.** One documented environment, reachable approved package source, own key, generated private config/MFA, browser input, real transcript and final report. Capture actual setup steps/time/errors. Keep speech/Teams explicitly optional until separately provisioned. The zero-dependency sample already offers immediate exploration.
3. **Make one decision-changing moment the centerpiece.** Human says “someone should fix it”; Rally asks who/by when; someone accepts; another proposal remains unassigned; “Hey Rally, what did we decide?” returns the exact distinction; report opens its source. Keep a normal-speed, synchronized real exchange. When video edits are authorized again, replace weaker screen-tour time with that moment; version06 remains untouched now.
4. **Measure quality on a small fixed set.** Suggested10fictional meeting scenarios covering proposals, accepted owners, withdrawn commitments, missing deadlines, jokes, useful tangents, interruptions, direct questions and prompt injection. Human-label expected commitments and silence opportunities. Report unsupported owner/deadline assertions, decision precision, semantic evidence support, unnecessary interruptions and response latency from end-of-question to first audible speech. Separate extraction accuracy from an end-to-end human-call run. These are proposed measurements, not existing results or promises of100%accuracy.
5. **Get small real-user evidence.** Two or three consented pilot meetings, with an observable before/after such as ownerless tasks clarified during the call or concrete report corrections. Report the actual numbers and who evaluated them; don't invent savings, customers or revenue. A specific paid-use hypothesis—e.g., engineering release-readiness meetings—is stronger than “every meeting everywhere.”
6. **Spend remaining polish on reliability.** Clear provider-offline states, consistent End/summary delivery, cancel/override and model readiness. Avoid adding more models, platforms or large features merely to increase the integration count.

The priority is demonstrable usefulness and reliable access. No new app/video changes were implemented by this review.
