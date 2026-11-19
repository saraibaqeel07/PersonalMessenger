# Push server (free, Vercel Hobby plan)

Sends a push notification to the receiver when a message is sent, so it arrives even
when their app is closed. Firebase stays on the free Spark plan; FCM itself is free.

## One-time setup

1. **Web push key** – Firebase console → Project settings → **Cloud Messaging** →
   *Web Push certificates* → **Generate key pair**. Copy the key into the app's `.env`:
   `VITE_FIREBASE_VAPID_KEY=...`

2. **Service account** – Firebase console → Project settings → **Service accounts** →
   **Generate new private key**. A JSON file downloads. Keep it secret, never commit it.

3. **Deploy this folder to Vercel** (free account at vercel.com, no card):
   - `npm i -g vercel`
   - `cd push-server` → `vercel` (accept the defaults) → `vercel --prod`
   - Vercel dashboard → this project → Settings → **Environment Variables**:
     - `FIREBASE_SERVICE_ACCOUNT` = the full contents of the JSON file from step 2
     - `ALLOWED_ORIGINS` = your app URL(s), comma separated, e.g.
       `https://your-project.web.app,https://your-project.firebaseapp.com`
   - Run `vercel --prod` again so the variables are used.

4. In the app's `.env` set `VITE_PUSH_URL=https://<your-vercel-project>.vercel.app/api/notify`

5. Deploy the app + rules: `pnpm build` then `firebase deploy`.

6. On each phone: open the installed app → **Me → Message notifications** → allow.
   (iPhone: the app must be added to the Home Screen first, iOS 16.4+.)
