# WhatsApp manual draft check — October 30, 2026

Bounded documentation/source inspection only. No WhatsApp draft links were opened, accounts accessed or messages sent.

## Confirmed official behavior

- **Numberless syntax:** `https://wa.me/?text=<URL-encoded text>`. WhatsApp explicitly documents this form for a prefilled message without a recipient number. Opening it presents contacts from which the user chooses recipients. The text populates a chat composer; opening the link is not evidence of sending or delivery. Click to chat is documented for phones and WhatsApp Web. [WhatsApp: How to use click to chat](https://faq.whatsapp.com/5913398998672934).
- **Manual send:** WhatsApp's messaging instructions describe entering text and tapping Send. Together with the documented composer/recipient-picker behavior, this supports the manual flow: review draft → choose recipient in WhatsApp → send there. No automatic-send behavior is documented for the numberless link. [WhatsApp: Send messages during a voice call](https://faq.whatsapp.com/1153602608602452/?cms_platform=android).
- **iOS:** WhatsApp also documents the numberless HTTPS form in its iOS linking guide and prefers universal links. Its separate `whatsapp://` scheme has native installation-detection requirements; those should not be generalized into requirements for an ordinary HTTPS link. [WhatsApp: How to link to WhatsApp from a different app](https://faq.whatsapp.com/425247423114725/?cms_platform=iphone).
- **Web session:** WhatsApp Web's official instructions require login/device linking, including a phone QR-scan workflow. A draft link does not establish that the browser already has a usable session. [WhatsApp: About WhatsApp Web](https://faq.whatsapp.com/668538004658079/).

## Local comparison and limits

[Existing client handler](../../apps/rally/web/client.js) builds `https://wa.me/?text=` plus `encodeURIComponent(draft)` and opens a new window with `noopener,noreferrer`. [Existing dialog](../../apps/rally/web/index.html) explicitly tells users to choose recipients and press Send in WhatsApp, and offers Copy text. This matches the documented manual handoff. [Draft builder](../../apps/rally/src/followup.js) returns text from eligible host-confirmed outcomes and applies a 6,000-character application cap; that cap is **not a verified WhatsApp or browser limit**.

**Unknown/unverified:** browser/app routing and intermediate prompts on each platform; popup blocking in Rally; preservation of text through login/linking; exact browser/version support; maximum reliable URL/text length; Unicode/newline fidelity; group/multiple-recipient picker behavior; and successful handoff or delivery on actual devices. The cited guidance does not establish these details. Copy text remains an available local fallback, not a tested delivery path.

Evidence caveat: direct Help Center reads returned empty readable bodies/app-shell content. Findings above use search-indexed text of the exact official WhatsApp pages; no third-party summaries support the claims. This confirms published syntax, not live platform behavior. No pricing conclusions or Business API integration claims are made. Only this file was written; no code changes, tests, commits or paid calls.
