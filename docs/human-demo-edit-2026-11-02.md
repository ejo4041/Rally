# Presenter and real-footage demo edit — November 2

The user supplied26portrait phone takes, a71.82second website GIF, and two Teams recordings. The local edit selects15complete presenter takes, drops repeated/unfinished attempts and preserves original speech speed. The newer November2call supplies60seconds across four real, synchronized meeting excerpts. October28footage was reviewed but not used. The GIF supplies agenda/setup visuals with original presenter narration.

Latest review master: `Rally - 3 Minute Demo - Review.mp4`, exactly180seconds,1920×1080,30fps/5400frames,H.264/AAC,20.85MB. Full FFmpeg decode passes. Measured audio peak−1.2dBFS, mean−19.1dBFS. SHA256: `db8d9f183483dcbbf710a7b15d5db8450d6138fda1c0dee3c0c6ffc0ca7868e0`. A separate120second clean presenter cut is retained.

The laptop folder is `C:\Users\Eoffermann\Downloads\Rally Demo Edit 2026-11-02`. The private server review bundle is `artifacts/feedback/human-demo-20261102/`: both review MP4s, captions, source/timing manifests and build recipes. Raw phone/B-roll sources remain on the laptop and are not committed to Git; the original source ZIP and media are untouched. Website captures omit login/MFA/Bitwarden/browser chrome and the cost-error banner. Teams crops exclude human faces/name badges, while actual meeting voices remain. The future platform is explicitly labeled proposed.

## Remaining review

A clean current completed-report/source-link/PDF close-up was not supplied. That section retains an explanatory feature card; the real wrap-up excerpt is not presented as proof of successful report generation. Caption transcription was local/offline and machine-assisted; listener wording/pacing approval is pending. Live segments are selected original-speed excerpts, not full response-latency measurements. Final publication requires the intended participant/footage approval. No public upload, submission, new provider request, meeting join or production change occurred.

The initial180second placeholder assembly remains local as historical edit guidance. The new master contains real footage in place of those silent slots. Read the private `REAL FOOTAGE REVIEW.md` and `real-footage-manifest.json` for exact shot locations; `build_broll_edit.py` contains the composition recipe. Rebuilding requires the original local sources plus the retained chapter designs/caption intermediates in the laptop folder, not just the server review bundle.

## Demo video version02 — November2

Version02replaces the reviewer-name discussion with23.5seconds of actual streaming transcription from the new user-supplied Teams recording. Audio and partial-caption progression remain at original speed. The final closing card is one second shorter to preserve exactly180seconds/5400frames at1080p30. Reviewer-name references are removed from both the replaced audio and sidecar captions. Version01is preserved byte-for-byte.

Local numbered exports: Downloads/Rally Demo Edit2026-11-02/`01 - Rally - 3 Minute Demo.mp4` and `02 - Rally - 3 Minute Demo.mp4`. Private server copy and edit/verification records: `artifacts/feedback/human-demo-20261102/versions/02/`. Version02SHA256:`7d7489d75e67b815246bc9ec76008b3f5b74dade7276fe91b086ef99586086f2`. Full decode, duration/frame count and previous-version hash checks pass. The replacement runs from1:27.47to1:50.97and uses source6.0–29.5seconds of Meeting with Eric Offermann-20261102_222047-Meeting Recording.mp4. The earlier real Rally speech sample remains. No new provider calls, service changes, public uploads or submission. Completed-report/PDF close-up and final listener review remain pending.

## Demo video03 and local submission preparation

Numbered version03adds muted group-meeting footage beside the human presenter, more real website/transcription footage in place of text cards, and a full-gallery view during one live guidance excerpt. The entire version02AAC audio stream is copied unchanged, and its live-transcript section remains intact. Participant tile name badges are masked. Exactly180seconds/5400frames at1080p30; full decoding, prior-export hashes and audio-stream hash comparison pass. Version03SHA256:`19acbe6d572400ba4cd7924dc9b07c5149898ec57c62c470b603eaaf92ba4a8c`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/03/`; local export: Downloads/Rally Demo Edit2026-11-02/`03 - Rally - 3 Minute Demo.mp4`.01and02are retained. No public upload/submission or provider call.

The owner supplied the exact submission questions. Their running draft is local at `C:/Users/Eoffermann/code/meta-hackathon-2026/docs/submission-form-working-draft.md`; keep that local file authoritative rather than copying unapproved survey responses into Git. It includes a judge invitation, provisional ratings, verified-model attribution, contributor/track review and pending final links. Anonymous GitHub access still returned404during preparation.

The owner explicitly requested judge username/password access. A dedicated ordinary user account was created and its password verified, without granting access to others' records, weakening MFA or changing any administrator account. Credentials are only in the owner's separate private Downloads file, outside Git. Current MFA enrollment is still required; owner choice between individual MFA access and a temporary judge-only password flow remains pending. The earlier no-shared-account sentence was an internal draft recommendation, not an event rule or an owner prohibition; it must not be presented as binding.

## Demo version04 — homepage opening

Version04changes only the post-cold-open left-side UI insert at6.10–13.03seconds. It shows the actual Rally home page from rally1.gif, holds for3.5seconds, then resumes the real pointer/New meeting click and creation dialog. Source GIF frames were decoded/composited sequentially to avoid seeking/disposal artifacts. Browser chrome/login/MFA are excluded; homepage hero, Meta cards and New meeting navigation remain visible. Presenter, version03audio, caption text and all subsequent timeline content are retained. Exactly180seconds/5400frames at1080p30; full decode, audio-stream hash match and preservation of01–03checks pass.

Local export: Downloads/Rally Demo Edit2026-11-02/`04 - Rally - 3 Minute Demo.mp4`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/04/`. SHA256:`21f956a6e35602b4c6cab8b80bbfd0705391c52020f7fa5509e523a8dda301e0`. The local form working draft now points to04as latest. No provider calls, production changes, upload or submission. Earlier numbered exports remain intact.

## Demo version05 — continue the new-meeting flow

Version05extends the post-cold-open website insert through21.93seconds: homepage,3.5second hold,Create click,title and agenda entry. It replaces the return to the problem slide at13.03seconds, then transitions directly into the unchanged group-meeting shot. The version04soundtrack/caption text and subsequent timeline content are retained. Brief isolated GIF home-screen flashes during modal entry are suppressed by holding the preceding real modal frame. Exactly180seconds/5400frames at1080p30; full decode and audio-stream hash match pass.01–04are preserved.

Local export: Downloads/Rally Demo Edit2026-11-02/`05 - Rally - 3 Minute Demo.mp4`. Private server copy: `artifacts/feedback/human-demo-20261102/versions/05/`. SHA256:`f586149c984b2265252f9496e33d5cf4aaa774d1801cd8f53ca480a988953c07`. The local submission working draft points to05as latest. No provider calls, production changes, upload or submission.


## Version 06 — November 3 recordings

New 180-second cut preserves version 05's human narration, cold open, home/create sequence and authentic spoken examples. New high-quality multi-participant Teams footage replaces older muted B-roll. `rally3.gif` supplies setup, streaming transcript, and Rally response close-ups. New B-roll is muted and labeled; it does not assert synchronization with older speech examples or measure model latency. No paid model call was used for editing. Versions 01–05 and original input media are retained.

Private local review file: `Downloads/Rally Demo Edit 2026-11-02/06 - Rally - 3 Minute Demo.mp4`, with numbered captions, edit manifest, verification record and build script. Final YouTube URL remains a submission task; no video has been uploaded automatically.
