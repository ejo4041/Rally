# Manual tab-audio sharing for Rally speech

Researched October 29, 2026. This is a possible free outgoing-audio route using the host's existing call. No real call, account, external message or paid connector was created to investigate it.

| Platform | Primary-source evidence | Assessment |
| --- | --- | --- |
| WhatsApp | [June 2024 screen/audio sharing announcement](https://blog.whatsapp.com/better-calling-across-desktop-and-mobile); [July 2026 browser-calling announcement](https://about.fb.com/news/2026/07/whatsapp-web-calling-new-features/) | Meta documents screen sharing with audio and current browser calls with screen sharing. It is plausible that a host can share Rally's tab audio, but these announcements do not establish the exact current browser/guest controls. Keep this as a live-check candidate. |
| Zoom Web | [Screen-sharing instructions](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0060596); [audio-sharing requirements](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0063608) | Zoom documents tab-audio sharing through its web client in Chrome. The host would choose Rally's tab from Zoom's Share control. This adds no bot or developer API. Host permissions and plan/meeting constraints still apply. |
| Zoom microphone behavior | [Official muted-audio troubleshooting](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0057913) | Zoom documents a web-sharing path where sharing tab audio mutes microphone input. A remote check must verify both Rally voice and host speech. Do not assume simultaneous audio succeeds just because the share begins. |
| Google Meet | [Presenting a Chrome tab](https://support.google.com/meet/answer/9308856); [screen-sharing feature comparison](https://support.google.com/meet/answer/16581830) | Google documents tab-audio presentation in Chrome. This is a credible manual route to test, with normal meeting/host controls and no additional API integration. |

Rally's new presenter view prepares a suitable visual surface: the current prompt and confirmed outcomes, with the private workspace/transcript hidden. Speech still comes from the existing self-hosted Meta MMS player. Turning on the view does not itself transmit video/audio to a call or join another participant.

The proposed directions are **call tab → Rally's input picker** and **Rally tab → call's presentation picker**. Sharing the wrong tab can create confusion or feedback. A consenting remote listener must check playback, microphone audibility, Stop speaking, Pause Rally, Stop sharing, absence of repeated self-transcription and final transcript drain before this becomes a demonstrated live feature. Current source/UI tests are not that evidence.

This route needs no paid connector or virtual audio driver. Existing Muse transcription/reasoning costs remain unchanged when live processing is started. It also shares the visible Rally surface; the host should stop sharing before returning to the workspace. No production audio-routing or voice-adapter behavior was changed for the presenter layout.
