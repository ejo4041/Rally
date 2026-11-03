# Presenter and real-footage demo edit — November 2

The user supplied26portrait phone takes, a71.82second website GIF, and two Teams recordings. The local edit selects15complete presenter takes, drops repeated/unfinished attempts and preserves original speech speed. The newer November2call supplies60seconds across four real, synchronized meeting excerpts. October28footage was reviewed but not used. The GIF supplies agenda/setup visuals with original presenter narration.

Latest review master: `Rally - 3 Minute Demo - Review.mp4`, exactly180seconds,1920×1080,30fps/5400frames,H.264/AAC,20.85MB. Full FFmpeg decode passes. Measured audio peak−1.2dBFS, mean−19.1dBFS. SHA256: `db8d9f183483dcbbf710a7b15d5db8450d6138fda1c0dee3c0c6ffc0ca7868e0`. A separate120second clean presenter cut is retained.

The laptop folder is `C:\Users\Eoffermann\Downloads\Rally Demo Edit 2026-11-02`. The private server review bundle is `artifacts/feedback/human-demo-20261102/`: both review MP4s, captions, source/timing manifests and build recipes. Raw phone/B-roll sources remain on the laptop and are not committed to Git; the original source ZIP and media are untouched. Website captures omit login/MFA/Bitwarden/browser chrome and the cost-error banner. Teams crops exclude human faces/name badges, while actual meeting voices remain. The future platform is explicitly labeled proposed.

## Remaining review

A clean current completed-report/source-link/PDF close-up was not supplied. That section retains an explanatory feature card; the real wrap-up excerpt is not presented as proof of successful report generation. Caption transcription was local/offline and machine-assisted; listener wording/pacing approval is pending. Live segments are selected original-speed excerpts, not full response-latency measurements. Final publication requires the intended participant/footage approval. No public upload, submission, new provider request, meeting join or production change occurred.

The initial180second placeholder assembly remains local as historical edit guidance. The new master contains real footage in place of those silent slots. Read the private `REAL FOOTAGE REVIEW.md` and `real-footage-manifest.json` for exact shot locations; `build_broll_edit.py` contains the composition recipe. Rebuilding requires the original local sources plus the retained chapter designs/caption intermediates in the laptop folder, not just the server review bundle.
