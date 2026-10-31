# Roomier home hero and browser-test recovery

The home hero now uses intermediate, explicitly bounded sizes: 320px on larger desktop windows, 280px at 1366×768, 260px at 1366×650, 218px at 1280×600 and 205px at 1366×550. Short/narrow windows retain compact sizing so the complete Built with Meta section remains visible. Meta descriptions remain 13px. Both themes use the same dimensions.

Validation: frontend typecheck, 17 unit tests, production build, and actual WebGL browser checks pass. Twelve desktop viewport sizes in both themes pass the full-section fit assertion at 100% zoom without horizontal overflow. Mobile, reduced motion, mascot lifecycle/disposal and zero audio/model requests also pass. Evidence: [browser results](research/hero-balance-browser.json).

## Shared-server incident and recovery

An isolated root browser-test session exhausted host memory during an experimental automatic sizing run. The kernel killed its MainThread process with approximately 4.8GB anonymous RSS at 2026-10-31 01:51:45 UTC; the containing session peaked at 5.2GB. SSH and application access were disrupted. Uptime confirms no reboot. The abandoned test scope session-1363.scope was stopped after recovery; production services and other developers' processes were preserved. The exact cause of test memory growth remains undiagnosed. The experimental layout was never deployed.

The experimental automatic sizing was replaced with explicit artwork dimensions. Replacement browser tests passed under a systemd transient unit capped at 1600MiB RAM, zero swap, 150% CPU and 120 seconds, with control-group cleanup. Screenshots now capture the bounded viewport. Future shared-droplet browser checks must use these limits; do not run unbounded GPU checks.

No paid model requests were made. Deployment and public verification are recorded in the current handoff.

## Deployment

Application commit `49fa5e3` is merged into main and active at `https://rally.tail703f9e.ts.net/`. Static-only release; API PID unchanged, backend source identical to previous release and SQLite backed up before atomic symlink switch. Public HTTPS validation passed real MFA, closed registration, appearance persistence, WebGL mascot, three laptop viewport fit checks, loading recovery, PDF, account sharing and revocation. Disposable synthetic records were removed. [Evidence](research/hero-balance-deployed.json).
