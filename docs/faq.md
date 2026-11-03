# Common questions

**Can I try Rally without an account or API key?**  
Yes. Open the [interactive sample](https://rally.tail703f9e.ts.net/demo.html), or serve `demo/` with Python as shown in the root README. Everything in that workspace is fictional.

**Does the sample call models or connect to my meetings?**  
No. It uses authored text and prerecorded Meta voices. It cannot access private meetings. Changes reset on reload; appearance preference is saved locally.

**What do I need for real transcription and reports?**  
Follow the [local setup guide](judge-quickstart.md): Node 24+, locked dependencies, LiveKit, private configuration, your own invited account with MFA, and a Meta Model API key with the required Muse access. Processing defaults off and enabling it can incur charges.

**Will a Meta API key alone give me a talking Teams bot?**  
No. Speech needs a configured model/service adapter. A Teams guest additionally needs Linux browser and virtual-media provisioning. Start with browser microphone/tab capture to evaluate reasoning and transcription.

**Do I need Azure ACS or an app registration?**  
The current guest-client Teams route does not require them. Older Azure/Sites experiments remain in the repository as historical work.

**Why can’t I sign up?**  
The full app has closed registration. A local operator creates the initial administrator invitation, then admins invite users. Each user enrolls MFA; the public sample uses no real account.

**Can everyone see a meeting report?**  
No. Full-app report access belongs to its host and specifically granted Rally accounts. Sharing can be revoked. Optional developer-feedback sharing is a separate control. Sample sharing is only an in-memory demonstration.

**What should I put in a bug report?**  
The browser/OS, revision, whether you used the sample or real app, exact reproduction steps and expected/actual behavior. Use fictional transcripts and redact credentials and meeting links. See [contributing](../CONTRIBUTING.md).

**Is Rally production-ready?**  
It is a hackathon prototype. The repository documents implemented behavior and measured checks; it does not promise every browser, media environment or model endpoint is supported. Read [capabilities](capabilities.md) and [security guidance](../SECURITY.md) before using real meeting data.
