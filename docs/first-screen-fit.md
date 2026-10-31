# First-login desktop viewport fit

User reported that Built with Meta was cut off at100% zoom and requested the complete hero plus Meta section visible immediately after sign-in.

Home-only desktop media queries reduce header/outer spacing, hero padding/headline size and decorative-art height as viewport height falls. Meta descriptions remain13px; headings/model names stay readable. Short layouts omit decorative eyebrows and tiny SVG illustration labels; actual model names and descriptions remain present. The page keeps normal scrolling for content below the first two sections. Meeting screens and mobile stacked layout are outside these desktop compaction rules. Navigating home resets window scroll to0, including after MFA/sign-in.

Headed Chromium actual-WebGL checks at100% zoom verify complete Meta panel bottom at least8px above the viewport edge, no horizontal overflow and13px descriptions in both themes at:1920×900,1536×864,1440×800,1366×768,1366×650,1280×600,1024×600,1366×550,1024×550. Smallest case ends at539.80px in550px height. These are CSS browser viewport sizes, accounting for toolbar/display-scaling differences rather than physical monitor size. [Evidence](research/first-screen-fit.json).

Actual mascot motion, reduced-motion still/resume, mobile layout, cleanup and zero audio requests still pass. Full synthetic feedback workflow and typecheck/build pass after compaction. No model calls or platform joins. Current source branch polish/first-screen-fit-20261030 in /srv/hackathon/rally-feedback, from main8205ab4. Merge/deployment results follow in handoff.
