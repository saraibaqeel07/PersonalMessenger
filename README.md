# Personal Messenger

Private messenger PWA. Only the admin can create accounts. Users add each other with friend requests and chat in real time.

**Stack:** React 18 + Vite, Firebase Auth + Cloud Firestore (real-time listeners, no sockets), Framer Motion, vite-plugin-pwa.

## Features

- Installable app: full screen, offline app shell, splash colour, home-screen icon.
- Navy and white theme, sized for every phone screen (safe areas, keyboard-aware layout).
- Admin panel: create users with email and password, make admin, rename, disable.
- Friend requests: send, cancel, accept, decline, remove friend.
- Real-time chat: typing indicator, online status, read ticks, unread badges.
- Emoji picker and GIF search (GIPHY).
- Disappearing messages, set per chat:
  - **Keep messages**: nothing is deleted.
  - **Delete after seen**: Snapchat style. The message is deleted once the receiver has seen it and leaves the chat.
  - **Delete after 24 hours**
- Long-press your own message to delete it for everyone.
- Animated transitions on screens, lists, sheets, bubbles and buttons.

## 1. Run locally

```bash
pnpm install
cp .env.example .env    # then fill it in (step 2)
pnpm dev                # opens on your LAN too, so you can test on your phone
```

Before `.env` is filled in, the app shows a "Connect Firebase" screen.

## 2. Connect your Firebase project

1. Go to <https://console.firebase.google.com>. Create a project, or use an existing one.
2. **Build → Authentication → Get started**. Enable **Email/Password**.
3. **Build → Firestore Database → Create database** (production mode, any region).
4. **Project settings → General → Your apps → Web (`</>`)**. Register the app and copy the config values into `.env`.
5. Deploy the security rules, the index and the TTL policy:

   ```bash
   pnpm dlx firebase-tools login
   pnpm dlx firebase-tools use --add                # pick your project
   pnpm dlx firebase-tools deploy --only firestore  # rules + indexes + TTL
   ```

   If you can't use the CLI, paste `firestore.rules` into **Firestore → Rules**. Then open the app: the first chat list query logs an error with a link that creates the missing index.

6. GIFs (optional): create a free API key at <https://developers.giphy.com/dashboard/> and set `VITE_GIPHY_API_KEY`.

## 3. Create the admin (first run only)

Open the app. While no admin exists, the login screen shows **Create admin account**. The first account created there becomes the admin, and setup locks permanently after that. **Do this right after deploying.**

After that, the admin opens the **Admin** tab and taps **+** to create users. The email and password are copied to the clipboard so the admin can send them to the user.

## 4. Deploy (Firebase Hosting)

```bash
pnpm build
pnpm dlx firebase-tools deploy --only hosting
```

PWAs need HTTPS. Firebase Hosting, Vercel and Netlify all provide it. To install the app:
- **Android/Chrome:** open the site and choose *Install app*.
- **iPhone/Safari:** tap Share, then *Add to Home Screen*.

## How it works

| Collection | Purpose |
|---|---|
| `users/{uid}` | Profile, role (`admin`/`user`), `disabled`, `lastSeen` |
| `friendRequests/{from_to}` | Pending requests |
| `chats/{uidA_uidB}` | One per friendship: last message, unread counts, typing, disappearing mode |
| `chats/{id}/messages` | Messages (`text` / `gif` / `system`) |
| `config/setup` | Exists once the first admin has been created |

- **Admin creates users without Cloud Functions:** the admin's browser uses a second, temporary Firebase app instance, so the admin stays signed in.
- **Security** is enforced in `firestore.rules`:
  - Only admins create or disable users.
  - Disabled users are blocked from everything.
  - A chat can only be created by accepting a real friend request.
  - Only the two people in a chat can read it.
- **Delete after seen:** when the receiver views the message it is marked as seen. When they leave the chat or put the app in the background, the message is deleted from Firestore for both people.
- **24 hours:** messages carry an `expireAt` field. The app hides and deletes them once that time passes, and the Firestore TTL policy removes them on the server as well.

## Limits

- **Passwords:** the admin can't change another user's password from the app, because that needs the Admin SDK. Reset it in Firebase console → Authentication, or users can change their own under **Me → Change password**.
- **Deleting accounts:** disabling an account blocks it fully. To remove the login itself, delete the user in Firebase console → Authentication.
- **Push notifications** when the app is closed need Firebase Cloud Messaging and a server (Cloud Functions, Blaze plan). They are not included.
- **Icons:** regenerate them with `node scripts/make-icons.mjs`.
