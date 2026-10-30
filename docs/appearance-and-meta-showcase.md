# Appearance and Meta showcase

All completed feedback/loading/Rally responses/Teams wrap-up work merged and pushed to main at2c8c0f5 by clean fast-forward from28df66f. Merge used dedicated `/srv/hackathon/rally-feedback-merge` worktree, leaving other developers' worktrees intact. New visual pass is on `polish/meta-showcase-20261030` in `/srv/hackathon/rally-feedback` and will be merged after verification.

## Product changes

Top-right Appearance selector offers Light, Dark and System, including the sign-in screen. Preference is stored per-browser origin in localStorage; unavailable storage falls back safely to System. A small first script applies the preference before CSS to avoid an initial light frame. System reacts to OS preference changes, and other tabs receive saved preference changes. No account credentials or meeting data are stored as preferences.

Full dark surfaces cover setup/forms, live guidance/transcript/sheets, reports/source chips, sharing, account/admin dialogs and notices. The outgoing camera renderer stays independent of the host theme. New home hero uses lightweight authored SVG ribbons, gradual decorative motion and mint action styling; the larger Built with Meta AI section gives each actual provider a role card. Hover lift and layered surfaces add depth. No new Meta services, model claims, paid requests, package downloads, external fonts or raster assets. Reduced-motion disables the decorative animation and movement. Home artwork is decorative, not live meeting data.

## Verification

17 frontend unit tests, typecheck/build, full feedback browser workflow and security browser regression pass. Extended browser check covers Light/Dark/System transitions, persistence after reload, OS theme changes, mobile header/selector fit, no horizontal overflow and reduced-motion artwork. The same browser workflow runs creation/live sheets/report/PDF/grants/revoke in dark mode. Desktop1440 and mobile390 screenshots inspected in both themes; follow-up fixes improved report/transcript contrast and mobile account/header spacing. An initial compositing artifact in the light hero was fixed by using direct background layers instead of a negative-z pseudo-element.

Artifacts remain on droplet under `apps/rally-web/test-results/showcase-*.png`, plus dark meeting/review screenshots. No live call or paid model test is needed for this frontend-only change. Existing narrated demo draft is not rerecorded. Deployment/merge results follow in handoff and research evidence.
