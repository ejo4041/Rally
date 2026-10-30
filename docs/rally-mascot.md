# Rally brand mascot

The homepage hero now uses the exact `mountPresence` / Living Silk renderer and default idle emotion configuration used by the meeting visualization, replacing the decorative SVG ribbons. It has a transparent backdrop to fit the hero and omits the meeting agenda/speech captions. It is a brand mascot, not a live meeting or model output.

The instance exists only while the authenticated home view is visible. Entering a meeting or signing out disposes it; returning home creates one instance. Normal offscreen/document visibility management remains enabled. Rendering starts in economy quality with pixel ratio capped1. Reduced-motion users receive a painted still frame, refreshed on resize, and motion resumes if their preference changes. The mascot never enables audio, microphone capture, transcription or model calls. Camera rendering and meeting defaults remain unchanged.

Verification: frontend typecheck/build and17unit tests, complete synthetic-provider feedback browser workflow. A headed Chromium/Xvfb real-WebGL test verifies changing rendered pixels, static pixels for reduced motion, motion resumption, desktop/mobile fit and both themes, one canvas after navigation back, disposal on meeting entry/logout and zero audio requests. Desktop/mobile screenshots visually inspected. [Evidence](research/rally-mascot-browser.json), raw images `apps/rally-web/test-results/mascot-*.png` on droplet. Zero model calls and package downloads.

Worktree `/srv/hackathon/rally-feedback`, branch polish/rally-mascot-20261030 from main883e8d3. Merge/deployment checkpoint follows in current handoff. No demo video rerecording, public upload or final submission.

## Deployment

Static release9c57bfe deployed and merged to origin/main. API source byte-identical to previous release; no API/media restart. Public authenticated headed-Chromium check confirms an actual WebGL mascot canvas without graphics fallback, plus appearance persistence, MFA/closed signup, PDF and report ACL workflows. Temporary test records removed. [Deployed evidence](research/rally-mascot-deployed.json). Zero model calls/platform joins. Final docs/operator-proof checkpoint merged afterward.
