# Free meeting-platform paths for Rally

Researched October 29, 2026 against the first-party sources below. The user requested free platform integrations with preference for Meta products. No new accounts, paid subscriptions, messages or real meetings were created for this research/build. Existing Muse transcription/reasoning remains billed against the current grant when a user explicitly starts real processing; free here means no added meeting-connector subscription.

## Selected implementation

Add a desktop browser-tab audio input to the existing meeting workflow. The host joins the meeting normally, then selects that meeting tab through the browser's sharing picker. Rally combines the tab audio with the host microphone when selected and sends mono PCM through its existing Muse adapter. The selected platform is descriptive meeting metadata; it does not authenticate the meeting or inspect its URL.

This path works at the browser audio layer and avoids a separate integration account for each service. It is host-side assistance: the app does not join a call as another participant or inject its prompts into the remote call. Physical call/browser compatibility still requires testing on the intended device. Captions/transcripts supplied by meeting platforms are not consumed.

## Platform assessment

| Platform | First-party evidence | Selected path and limits |
| --- | --- | --- |
| WhatsApp | [Guest-calling announcement](https://blog.whatsapp.com/now-you-can-invite-anyone-to-a-whatsapp-call-no-account-needed-no-cost-no-time-limit), October 14, 2026; [web calling announcement](https://blog.whatsapp.com/introducing-web-calling-on-whatsapp-plus-more-new-updates), July 28, 2026 | Priority Meta surface. WhatsApp documents free browser guest calls with host admission and groups up to 32. A WhatsApp account is required to create a call link. Use a browser call tab for the new capture path. A Rally guest-participant adapter remains unverified without an actual invite/host. |
| Zoom | [Browser guest joining](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059553) | Join through the host-provided browser link when enabled, then share its tab audio. Host authentication/waiting-room restrictions and the host's normal plan limits apply. No Zoom developer subscription is added. |
| Google Meet | Browser meeting surface; the implementation uses the same generic capture contract | Preset for a host-selected Meet browser tab. No Google API integration, native transcript consumption or automated joining is claimed. Actual call compatibility is pending. |
| Jitsi Meet | [Official user FAQ](https://jitsi.org/user-faq/); [host authentication announcement](https://jitsi.org/blog/authentication-on-meet-jit-si/) | Open-source/free meeting option. The public meet.jit.si service requires an account to create a room; joining and permissions depend on the room. Use the meeting tab. Self-hosting Jitsi is possible but adds operations and is not necessary for this path. |
| Messenger | [Meta's earlier desktop/browser calling announcement](https://about.fb.com/news/2020/04/messenger-desktop-app/) | Relevant Meta candidate, but the retrieved source is historical and does not establish the current browser/account behavior. Use the generic Other browser meeting option only when the user's call actually runs in a shareable tab. No dedicated Messenger adapter or current Rooms availability is claimed. |

### Zoom developer options excluded from the free build

The [RTMS overview](https://developers.zoom.us/docs/rtms/) requires credits. The current [RTMS troubleshooting/plan page](https://godevelopers.zoom.us/docs/rtms/troubleshooting/) describes a Developer Pack requirement. An older developer-forum answer differs on Basic-plan support, so actual entitlement should be checked before ever selecting RTMS. Neither source establishes a guaranteed free production route.

Zoom also [documents built-in web-app bot detection and approved integration paths](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0088381). This build uses the user's ordinary meeting tab rather than automating Zoom login/joining or attempting to bypass those controls. No paid meeting-bot transport is selected.

## Capture contract and constraints

[Chrome's screen-sharing controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls) document tab audio and the ability to exclude system audio/current-tab capture from the picker. The app requests those controls and additionally validates that the returned display surface is a browser tab with a live audio track. It refuses screen/window selection or missing audio, then closes any partially acquired tracks.

The browser requires a video track for display selection. Rally retains the selection handle so Stop sharing works but connects only audio tracks into the PCM processor. No screen frames are uploaded, encoded or saved. Optional microphone input is mixed at reduced gains to preserve headroom. Browser/OS support varies; a missing audio option produces an explicit error rather than silently falling back to room audio.

Rally's voice prompts stay with the host. Meeting-tab sessions default to visible prompts; the host may enable local speech, using headphones to reduce acoustic feedback. This is not a virtual microphone injected into WhatsApp/Zoom/Meet/Jitsi. The existing Teams server transport remains a separate route.

## Free WhatsApp follow-through

[WhatsApp click-to-chat documentation](https://faq.whatsapp.com/5913398998672934) supports a URL containing a prefilled message and recipient selection. Rally prepares a preview containing only explicitly confirmed outcomes with current transcript evidence. The user can copy it or open a WhatsApp draft, choose the recipient and send there. No WhatsApp Business API, phone-number provisioning, token, message template or automatic send is required.

Only the reviewed draft is included in that external URL; the complete transcript and meeting invite are excluded. Opening the draft passes that text to WhatsApp. Preparing the preview stays inside the protected app. This feature is manual sharing, not an automated business messaging integration.

## Evidence and next live checks

The browser test combines synthetic 440 Hz meeting-tab audio and 880 Hz microphone audio through the actual AudioContext and 16 kHz PCM worklet. Both signals reach the outbound PCM stream; missing audio and wrong display selection stop before a model session is opened. Ending the selected tab closes all captured tracks. These are synthetic stream/transport tests, not verified real calls on each platform.

Use a consenting real call to check browser tab-audio availability, host/remote voice coverage, Stop sharing, transcript final drain and normal model cost reconciliation. For a future WhatsApp participant, supply a fresh browser guest call link and verify admission, audio receive/send, host controls and departure before claiming live participant support. No further integration should depend on purchased credits or a paid bot service under the current instruction.

## Additional verification

The native Chromium display-capture check now passes using a private Xvfb display with a window manager. A real `getDisplayMedia` capture of a synthetic local 660 Hz audio tab reached the local level meter and the outbound PCM worklet. The provider connection was mocked; this is not a Zoom/WhatsApp call. [Measurement](native-tab-browser-check.json). The new local audio check detects each selected source and stops after 15 seconds without model requests.

A follow-up check of current [Messenger help](https://www.facebook.com/help/messenger-app/448372435190713/) and [Instagram calling help](https://www.facebook.com/help/instagram/136585180482293) returned login/temporary-block pages, so their current call/browser requirements could not be established from accessible primary text. No dedicated preset or working-call claim was added for either. WhatsApp remains the best-supported Meta candidate from the accessible [current guest-calling announcement](https://about.fb.com/news/2026/10/introducing-whatsapp-guest-calling/).
