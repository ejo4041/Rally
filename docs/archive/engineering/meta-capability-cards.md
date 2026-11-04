# Illustrated Meta capability cards

Requested: more visual pop in Built with Meta and slightly larger typography. Source branch polish/meta-cards-20261030, droplet workspace /srv/hackathon/rally-feedback, from current main ef98b37.

Three authored SVG scenes replace the single stacked glyphs: Spark connects agenda, decisions and next steps; Voice Transcribe converts an abstract waveform into text rows; Seamless/MMS use a speaker and concentric sound rings. Purple/mint/blue accents, separate art panels, top-edge highlights and restrained hover glow/lift add depth. The illustrations are decorative, not actual audio levels, current meeting data or official provider logos. Actual service names/roles remain unchanged.

Descriptions13px (previously10), headings16px (previously13), model badges10px (previously8), section title33px. Mobile descriptions13px/headings17px. Dark/light palettes stay legible. Wave/ripple motion is disabled for reduced-motion users and paused when home is hidden. No new WebGL instances, model/audio calls, paid providers, external assets or package downloads.

Validation:17 frontend unit tests, typecheck/build, full synthetic feedback browser workflow. Added assertions for three illustrated cards, larger copy/headings and disabled decorative motion. Desktop1440/mobile390 screenshots reviewed in both themes; no horizontal overflow. The headed real-WebGL mascot acceptance also passes, including animated/still/resumed rendering, zero audio requests and navigation cleanup. Tests create no real meeting or paid calls. Deployment and main merge checkpoint follows in handoff.

## Deployed

Static release69720b3 is active at https://rally.tail703f9e.ts.net/ and merged into main. Backend source compared byte-for-byte, SQLite backed up, no API/media restart. Public actual-WebGL mascot, theme persistence, MFA, loading, PDF and report ACL checks pass with temporary records removed. [Evidence](../../research/meta-cards-deployed.json). Final documentation checkpoint merged afterward.
