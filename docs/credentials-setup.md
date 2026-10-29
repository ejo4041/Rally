# Local Muse API credentials

1. Open [Meta's developer dashboard](https://dev.meta.ai/), sign in, then choose **API keys → Create API key**. Name it for Rally and copy it when displayed. [Official authentication instructions](https://dev.meta.ai/docs/authentication).
2. Open `/srv/hackathon/repo/.env.local` and paste the key after the equals sign:

   ```dotenv
   MODEL_API_KEY=your_key_here
   ```

3. Save the file and tell the agent it is ready. Do not paste the key into chat or Markdown.

The file has been created with owner-only permissions and verified as ignored by Git. `.env.example` contains only the empty variable name and is safe to commit. No app or loader exists yet; subsequent test tools must explicitly load `.env.local` without printing its contents or executing it as shell code. Keep the key server-side.

Per the supplied event guide, check that your $150 hackathon credits are applied in Billing and complete required payment setup before calls. The guide describes a spend notification, not a guaranteed hard spending cap.
