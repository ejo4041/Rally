# Manual WhatsApp follow-up in integrated Rally

After a report is ready, **Draft WhatsApp follow-up** opens a local review dialog. Nothing is selected initially. The host chooses decision/action rows, then edits the resulting draft. Reported agreement, proposal and unresolved labels remain explicit; unknown owners/dates stay unresolved. The full transcript, evidence IDs and internal ticket drafts are not included automatically.

**Open WhatsApp draft** hands the reviewed text to WhatsApp's numberless click-to-chat flow. The user chooses recipients and sends in WhatsApp. Rally makes no messaging API request, requires no Business API account and does not record delivery. Opening the link exposes the draft text to WhatsApp, so the dialog explains that before the handoff. Copy draft is a local alternative. No message has been sent by the implementation or tests.

Drafts are temporary browser state and are cleared when the dialog closes, the host navigates or signs out, or the source report/labels change. An outdated report shows a warning. Draft sharing is unavailable while capture is live, and an open draft closes if capture resumes. Changing item selection rebuilds the draft, which the dialog states before editing. The app caps link drafts at 1,500 characters; this is Rally's own conservative limit, not a verified WhatsApp service limit. Longer drafts remain editable but cannot open the link until shortened.

Tests cover preserved uncertainty, omitted private metadata, empty selection, Unicode/newline encoding, fixed WhatsApp origin, long-text rejection, editing, close cleanup and unchanged model-call counters. Browser tests inspect the link without opening WhatsApp. They do not establish actual device routing, login persistence, recipient selection or delivery. [Official-source check and limits](research/whatsapp-manual-draft-check-2026-10-30.md).

This is follow-through for a completed meeting, separate from the [WhatsApp guest calling prototype](whatsapp-guest-prototype.md), which still needs a fresh host link and admission/audio validation.
