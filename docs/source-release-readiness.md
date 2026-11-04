# Source release readiness — November 1, 2026

Current work prepares a reviewable source package; final submission is on hold. The supplied participant guide requires a public repository and identification of original work/contributors. Source push success does not establish anonymous access. The November 1 anonymous repo request still returned 404; no visibility change was made. Authenticated GitHub settings are not available through the configured tools in this checkout.

## Original work and attribution

The source identifies Rally's newly implemented meeting lifecycle, evidence/agenda policy, model adapters, controlled speech, Teams transport, presence integration, reports/sharing and access controls. Keep Meta model names, local execution locations and unknown remote revisions explicit. Preserve [component notices](../THIRD_PARTY_NOTICES.md), original Living Silk archives and bundled Three.js attribution. Do not claim supplied artwork or model implementations as original Rally work.

Git author labels are software/operational identities, not proof of the human contributor list. The owner's final human contributor confirmation remains pending. This record does not infer contributors from commit email strings, hide legitimate attribution or assert unverified solo authorship.

## License decision

On November 4, the owner authorized selecting and implementing a license. Rally's original code and documentation now use the [MIT License](../LICENSE), with copyright attributed to Eric Offermann and Rally contributors. [Scope and outstanding third-party rights](licensing.md) distinguish this grant from model/service/artwork terms. Earlier records describing an unselected application license are historical. Contributor ownership and supplied-artwork permissions remain separate from this application license.

The supplied Living Silk artwork/runtime lacks a separate explicit redistribution-license record in the inspected package; only its included Three.js notice is present. Obtain the original supplier/owner's permission or license record before publishing that component. Do not replace the original attribution or infer rights from it having been supplied. The owner can identify the asset origin and approved distribution scope.

## Source access and archive

Before sharing source, the owner should check repository Settings → visibility, choose the intended public repository after confirming rights/private-data review, and verify https://github.com/ejo4041/Rally signed out. Public access remains unverified while 404 persists. No repository visibility was changed by this preparation.

The local exporter uses only Git-tracked files and filters runtime databases, credentials, browser profiles, dependencies and model weights. Run its regression test and inspect the actual resulting ZIP for private runtime material. Record source revision, file count and SHA-256; retain the archive locally under /tmp until publication is authorized. A clean current archive does not prove historical Git objects contain no private data, and does not resolve the human contributor or asset-rights decisions.

## Remaining owner inputs

- Confirm the actual human contributor list and rights to contributed work; application license selection is complete (MIT).
- Living Silk artwork redistribution permission/source record.
- GitHub anonymous access/visibility and actual judge recipient identity/private invitation delivery.
- Authenticated portal fields and final publicly accessible video URL after footage review.

Everything else can be tested/prepared without these inputs; do not mark these items complete by assumption. [Current submission draft](https://github.com/ejo4041/Rally/blob/b9bdd26b12b6eadc7b276ca91e6817be0d6ceca5/docs/submission-package.md) and [judge access rehearsal](judge-access-rehearsal.md) keep entry actions pending.

## Prepared private archive

The [source snapshot audit](research/source-archive-2026-11-01.json) pins the actual source revision and ZIP hash/file count. ZIP integrity, configured-secret matching and explicit runtime/model/dependency/private-key/invite filters passed. The archive remains private under /tmp; it is not a public source release, historical-object audit or license/access confirmation.


## November 3 judge setup audit

The credential-free hosted path is `/demo.html`; the prior private judge-credential proposal is superseded. Current setup instructions are in [judge quickstart](judge-quickstart.md), including offline sample serving, Nexus installs for all three packages, generated persistent MFA key, closed-registration administrator activation and optional paid calls with an evaluator's own key. The root `.env.example` now describes the current Node application rather than the historical Azure/Sites prototype. The combined launcher loads the selected checkout's configuration before calculating child settings.

Anonymous GitHub access still returned HTTP 404 on November 3. Repository visibility has not been changed by this audit. Full fresh API dependency installation could not complete: Nexus is unresolved from the droplet and the offline cache lacks a required tarball. Frontend and Living Silk installs succeeded from the existing offline cache through the Nexus configuration. Backend tests therefore used the previously installed backend dependencies; do not describe that as a clean API install. No npmjs fallback was used.

Source candidate scanning found only environment reads and explicit test fixtures among the scanned credential patterns; this is not an exhaustive history or credential audit. Existing application-license/artwork attribution decisions above remain recorded; this update does not choose or grant a license.
