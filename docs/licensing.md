# Licensing

Rally's original application code and accompanying documentation are licensed under the root [MIT License](../LICENSE), copyright 2026 Eric Offermann and Rally contributors. This license was selected and added at the owner's request on November 4, 2026. It permits use, modification, redistribution and commercial use subject to preserving its copyright and permission notice, with the stated warranty disclaimer. Reference: [Open Source Initiative's MIT text](https://opensource.org/license/mit).

The supplied hackathon instructions require a public open-source repository and appropriate rights/attribution. MIT supplies an established open-source license for Rally's original work. It does not by itself make a private repository public, establish ownership of supplied assets or guarantee final event eligibility. Public repository access must still be verified separately. No final submission or visibility change is performed by adding this license.

## Scope and existing licenses

The root license covers original Rally code and documentation where a more specific notice does not apply. Third-party work retains its own license, copyright and conditions, including material bundled in compiled demo assets. Preserve the applicable notices when copying or distributing those assets.

| Material | Applicable terms / current record |
| --- | --- |
| Original Rally application code, integration code and documentation | Root MIT license. Third-party inclusions and supplied components below remain separately governed. |
| Vendored fairseq definitions | Upstream MIT copyright/license retained under `experiments/meta-fastspeech2/vendor/LICENSE`; source hashes/provenance remain intact. |
| CMU pronunciation dictionary | Original CMU license retained under `packages/rally-speech/vendor/CMUDICT-LICENSE`. |
| Dependencies such as LiveKit, Three.js and Express | Their upstream licenses; see [component notices](../THIRD_PARTY_NOTICES.md) and distribution-specific notices. |
| Meta MMS and Seamless model weights | Recorded CC BY-NC 4.0 model terms. These are not relicensed under MIT; model weights are not included in the source export. Do not assume commercial model deployment rights from Rally's code license. |
| Experimental FastSpeech2 and bundled vocoder | Publisher provenance and upstream pretrained-model MIT basis documented in the [research](research/meta-phoneme-backend-feasibility-2026-11-02.md). Weights are provisioned separately. |
| Hosted Muse services | Provider/account terms. Rally's license does not grant API access or service rights. |
| Supplied Living Silk artwork/runtime under `packages/living-silk/` and its bundled copies in the demo/media | Excluded from Rally's original-work grant pending explicit owner/supplier licensing evidence. Its included Three.js MIT notice licenses Three.js, not the supplied artwork as a whole. Original attribution is preserved; redistribution permission still needs confirmation. |
| Generated speech samples | Model/source attribution and provenance retained in [demo audio notes](../demo/demo-audio/README.md); the application license does not assert additional model-output rights. |
| Private recordings, real participant content, credentials and runtime databases | Not part of the application license grant or intended source distribution. |

## Remaining release work

Confirm the supplied artwork/runtime's redistribution license or replace/remove that component and its bundled copies before treating the entire distribution as cleared for public release. Verify the human contributor roster and permissions for contributed material. Model commercial-use conditions must be reviewed against the exact deployment; the MIT application license alone does not clear a commercial voice stack.

This resolves the missing root application license. Existing asset-rights and repository-access checks remain open in [source release readiness](source-release-readiness.md). Full component details remain in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
