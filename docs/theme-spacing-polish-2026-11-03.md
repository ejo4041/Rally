# Theme and spacing polish — November 3, 2026

Owner request: fix unexpected white areas in dark mode and inconsistent spacing throughout the regular app and simulated demo; continue testing without waiting for feedback. Work isolated on `fix/theme-and-spacing-polish` in `/srv/hackathon/rally-public-demo`; shared developer worktree untouched. No real meeting connections, model calls or changes to account policy.

## Findings and changes

- Browser theme-color metadata now follows light/dark/system selection as well as the CSS palette, instead of remaining light on mobile.
- The root document retained the original light background, even when body was dark. Document canvas and body now share theme tokens, including short pages and overscroll. Core panel backgrounds use surface tokens.
- The demo workspace had a fixed viewport height and a fixed banner offset. Content can now grow normally; a ResizeObserver measures the banner height for sidebar and sticky meeting tabs, including wrapped text.
- A first-paragraph selector enlarged the provider attribution instead of guidance in the live card. Guidance and attribution now have explicit typography rules.
- Replies, report provider attribution, action buttons, evidence controls and sheets now have consistent internal padding. Report actions no longer lose padding when their form is hidden. Review Back aligns with the left edge.
- Agenda details and secondary copy use readable theme colors. Light-mode label, evidence and score colors were also corrected after computed contrast checks.
- Long fractional agenda budgets display to one decimal, without changing stored budgets.
- Mobile setup puts connection/start controls before the full plan. Live mobile presence is shorter so guidance fits above controls; sheets use their own padding. Demo settings hide unavailable voice controls even after DOM movement into the settings sheet.
- The demo hero has a short-laptop variant to account for the additional demo notice; regular site hero proportions remain unchanged.

## Validation in progress

All browser checks run one at a time in transient systemd units with 1600 MB memory, no swap, 150% CPU and a 120-second deadline, preserving production services. Screenshots are viewport-sized. Artifacts: `/srv/hackathon/artifacts/theme-polish-20261103/`.

Initial before/after passes: 48 screens each. Intermediate phone/tablet and wide passes: 72 screens each. Final strict screen matrix, natural replay stress/PDF and deployment smoke results will be appended when complete. The audit checks document/body backgrounds, bright surfaces in dark mode, horizontal overflow, dialog bounds, text contrast for visible nondecorative text, page errors and absence of demo API/WebSocket requests. Decorative SVG artwork and disabled controls are excluded from the text contrast check. This is targeted automated coverage, not a complete accessibility certification.

Regular-app `feedback-browser.mjs` passed against isolated HTTP/MFA/database/LiveKit and synthetic audio/providers: themes and system setting, source agenda, preparation loading/retry, mobile sheets, separate Rally replies, final report, real PDF, named-account sharing and revocation. `security-browser.mjs` passed against an isolated fixture. Production credentials and meeting records were not used.

## Completed validation

| Check | Result |
| --- | --- |
| Frontend units/typecheck/build | 20 unit tests passed; TypeScript and build passed; portable assets regenerated with hashes. |
| Final strict screen matrix | 240 screens: 320, 390, 650, 760, 761, 768, 850, 1024, 1280 and 1440 CSS px; dark/light; 12 states each. Zero page errors, API/socket requests, bright dark surfaces, page overflow, dialog-bound violations or measured text-contrast warnings. |
| Short laptops | Another 48 screens at 1280×720 and 1440×720. Both themes fit the full hero and Meta section, ending at ~648 px. Same strict checks passed. |
| Complete natural replay | 72-second full scripted run, all 17 participant turns and scripted replies. Themes and viewport sizes changed during partial/final streaming. Eight history/home cycles preceded the meeting. Final report, evidence, real PDF generation and reload cleanup passed. JS heap samples approximately4.9–7.1MB, without a growing trend in this bounded run. |
| Keyboard/theme/print | Cross-tab theme sync, reduced motion, transparent mascot panel, Enter/Tab/Escape without background-control focus, opener focus restoration, print title/white document and return to dark screen passed. Native browser-chrome focus remains available. |
| Ordinary-app integration | Feedback, security (including dark sign-in/enrollment), meeting setup and history/navigation suites passed using isolated HTTP/MFA/database and, where required, LiveKit/synthetic audio/providers. PDF, grants/revocation, prepare failure/retry, invite validation and mobile sheets exercised. |

Artifacts and before/after gallery: `/srv/hackathon/artifacts/theme-polish-20261103/index.html`; aggregate machine-readable report `validation-summary.json`; final matrices in `final-small/`, `final-wide/`, `laptop/`; replay/PDF in `stability/`. Test sources are checked in under `apps/rally-web/tests/`: `theme-layout.browser.mjs`, `demo-stability.browser.mjs`, `demo-keyboard.browser.mjs`, plus the existing ordinary-app regressions.

Two harness timing assumptions were corrected during validation: wait for a dialog’s asynchronous close/restoration before asserting node placement, and wait until report actions are enabled before keyboard activation. Native modal focus may move to browser chrome between tab cycles; the check forbids background page controls, rather than replacing the browser’s focus behavior. Final runs passed. These were test timing corrections, not relaxed product failure handling.

Coverage limits: automated Chromium on the Linux droplet, with renderer fallback when GPU support is unavailable. No claim of physical Android/iOS or Safari validation, real Teams meetings, actual voice quality, live-model latency or multi-hour endurance. No paid processing or access to real meeting content was needed. The 72-second replay is a bounded stability check, not a production load test.

## Deployment

Prepared for a static frontend-only release after tested branch merge. Preserve the current API/media process and byte-identical backend; make a private SQLite backup and atomically switch only after staging/copy checks. Final release and public smoke result are recorded in the handoff.

## Re-running checks

From `apps/rally-web`, build the shared UI and portable sample first:

```sh
node scripts/build.mjs
node scripts/export-demo.mjs
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Browser entrypoints: `tests/theme-layout.browser.mjs`, `tests/demo-stability.browser.mjs`, `tests/demo-keyboard.browser.mjs`, `tests/demo.browser.mjs`, and the existing feedback/security/setup/history scripts. On the shared droplet, always use the bounded systemd wrapper mandated in `AGENTS.md`; do not launch browser checks directly. Run one browser unit at a time. Visual configuration: `RALLY_VISUAL_WIDTHS` comma-separated widths; `RALLY_VISUAL_HEIGHT` for a fixed height; `RALLY_VISUAL_STRICT=1`; `RALLY_VISUAL_OUT` artifact directory. `DEMO_PUBLIC_URL` selects the deployed demo for the visual and workflow smoke checks; omit it for the portable local sample. The complete replay test intentionally waits for natural playback instead of fast-forwarding synthetic timing.

Public verification on the first polish release passed the real hosted demo workflow and48 strict screen states, including both themes at390 and1280px. Normal app authentication remains required. API health stayed good and process PID unchanged. An additional keyboard/theme test covers synchronized browser theme-color metadata. Final release confirmation is in `docs/handoff.md`.
