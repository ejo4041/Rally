# Rally v0.1

A private browser meeting moderator powered by Muse Voice Transcribe and Muse Spark 1.3. An ES-module Worker backend, D1 persistence, and a same-origin HTML/JS frontend are packaged through the Sites workflow.

## Local development

Requires Node.js 24+ and npm. From this directory:

```bash
npm ci
npm run build
npm run dev
```

Open the printed localhost URL. The default dev server disables paid calls; the explicitly labeled walkthrough works without a microphone or model requests.

To enable Muse locally, configure `MODEL_API_KEY` in the root repo's ignored `.env.local`, then run:

```bash
RALLY_PAID_ENABLED=1 npm run dev
```

The dev server binds loopback. Do not expose it as an anonymous public shared workspace. Phone capture needs HTTPS; a plain laptop LAN address is not a secure microphone context.

## Features and boundaries

Agenda, outcome, roster, duration and editable opening; consent-gated streaming PCM; bounded Muse moderation; browser speech and immediate host controls; transcript-evidenced proposals with explicit host confirmation; five-minute default wrap-up; saved history, scorecard, export and deletion. The compressed demo clock and zero-cost scripted walkthrough are clearly labeled.

Microphone audio is shielded while Rally speaks to reduce self-voice contamination; host Stop returns the floor. Automatic spoken barge-in and verified voice identity are not claimed. Host correction and unknown speakers are explicit. Model output cannot confirm commitments itself.

## Verification

```bash
npm run build
npm test
npm run validate
```

Rendered browser QA: install Playwright Chromium/platform libraries, start the dev server, and run `npm run test:browser`. It makes no paid calls. `tests/live-smoke.mjs` is a separate explicitly paid integration test, never part of the default suite. Headless tests do not verify physical speaker sound, phone behavior, room echo or Teams. Actual verification is recorded in the root `docs/build-progress.md`.

## Hosting and secrets

`.openai/hosting.json` retains the Site identity and D1 binding. Native Sites tools configure `MODEL_API_KEY` as a server-side secret. Keep the Site owner-private: this shared workspace relies on Sites access policy, not a separate account system. A public source repository is distinct from private product access.

Build with `node scripts/build.mjs`, validate with `node scripts/validate-artifact.mjs`, and package/publish with the Sites source helper. Schema-only migrations are under `drizzle/`. Local `.data` and hosted D1 are separate. The source helper owns this directory's nested Git checkout; use the sanitized export tool when preparing the standalone public submission.

## Cost controls

`RALLY_PAID_ENABLED=1` enables real calls; opening the app never triggers one. `RALLY_MEETING_BUDGET` defaults to $0.25 and `RALLY_BUILD_BUDGET` to $0.50. These are local forecast gates, not provider-enforced spend caps. `RALLY_BASELINE_SPEND` carries earlier tracked experiments; the app adds its persistent usage to that baseline. Reconcile exported usage before changing the baseline to avoid double counting.

The displayed credit remainder assumes a full applied $150 grant and no untracked usage; actual Billing remains unverified. No raw audio is intentionally persisted by Rally. Provider retention needs separate verification; this is not a blanket zero-retention claim.
