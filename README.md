# ATN Workspace

A static (no build step) web app — plain HTML/CSS/JS, Firebase Web SDK loaded
straight from Google's CDN. There is no Vite/Webpack anywhere in this project;
it's meant to be opened with any static file server.

## Why "Sign In" wasn't doing anything

The console showed:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'VITE_FIREBASE_API_KEY')
  at config.js:8
```

`firebase/config.js` (and `firebase/messaging.js`) were written as if the
project were bundled with **Vite**, using `import.meta.env.VITE_FIREBASE_*`.
But nothing here goes through Vite — there's no `package.json`, no
`vite.config.js`, and every Firebase import is a raw
`https://www.gstatic.com/firebasejs/...` URL. In a plain browser, `import.meta.env`
is simply `undefined`, so reading `.VITE_FIREBASE_API_KEY` off it threw and
crashed the whole module before it ever got to `initializeApp()`.

Because `index.html` loads `components/auth.js` as a `type="module"` script,
and that module imports `firebase/config.js` at the top of its import chain,
**the crash happened before any of your event listeners were attached** — so
clicking "Sign In" visibly did nothing. That's the "next page not going"
symptom.

## The fix

- `firebase/config.js` and `firebase/messaging.js` now import a plain
  `firebaseConfig` object from `firebase/firebase-keys.js` instead of reading
  `import.meta.env`.
- `firebase/firebase-keys.js` is a new file, listed in `.gitignore`, where
  you paste your **real** Firebase project credentials.
- `firebase/firebase-keys.example.js` is the checked-in template so anyone
  cloning the repo knows what shape the file needs.

## Setup

1. **Get your Firebase config.** In the
   [Firebase Console](https://console.firebase.google.com), open your
   project → ⚙️ Project settings → General → "Your apps" → the web app (or
   create one with the `</>` icon). Copy the `firebaseConfig` object shown
   there.
2. **Fill in `firebase/firebase-keys.js`** with those real values (this file
   already exists in this build with placeholders — just replace them).
3. **Enable the services you use**, in the left sidebar of the console:
   - Authentication → Sign-in method → enable Email/Password and any
     OAuth providers you want (Google/GitHub/Facebook/Apple), and Phone if
     you use the OTP tab.
   - Firestore Database → Create database.
   - Storage → Get started.
4. **(Optional, for push notifications)** In Project settings → Cloud
   Messaging → Web configuration → generate a Web Push certificate (VAPID
   key), and:
   - paste it as `vapidKey` in `firebase/firebase-keys.js`
   - paste the same `firebaseConfig` values into
     `public/firebase-messaging-sw.js` (service workers can't import your
     keys file, so those stay hardcoded there — they're already stubbed
     with `YOUR_API_KEY` etc.)
5. **Run it.** Any static server works, e.g. one of:
   ```bash
   npx serve .
   # or
   python3 -m http.server 5500
   ```
   or the VS Code "Live Server" extension (this is what the
   `127.0.0.1:5500` URL in your screenshot is). Then open the served
   `index.html`.

## Why Save / Add Column / Add Task / Share / Reminders / Activity all "don't work"

This is very likely a **second, separate** issue from the Vite one above —
and it explains basically every remaining symptom at once (Save doing
nothing, Add Column/Add Task closing without adding anything, exports
coming back empty, Share stuck forever on "Generating a shareable link…",
"Upcoming Reminders" always empty, the Activity chart always flat at zero).

There was **no `firestore.rules` file anywhere in this project.** That
means Firestore has been running on whatever default it was given when you
clicked "Create database" in the console:
- **Production mode** → deny absolutely all reads/writes → every single
  Firestore call in the app (`setDoc`, `updateDoc`, `getDocs`,
  `onSnapshot`, ...) fails with a `permission-denied` error.
- **Test mode** → allowed everything for 30 days, then automatically
  reverted to deny-all — if your project is more than a month old, you've
  likely just hit that expiry.

Either way, the app's own code was never the problem for these features —
there was nothing to configure it to talk to Firestore with permission.

**To fix it:** this build adds `firestore.rules`, `storage.rules`,
`firebase.json`, and `firestore.indexes.json` to the project root. Deploy
them with the [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools   # if you don't have it yet
firebase login
firebase use --add               # pick your "advance-tasks-notes" project
firebase deploy --only firestore:rules,storage
```

Or, without the CLI: open the Firebase Console → **Firestore Database →
Rules** tab, paste in the contents of `firestore.rules`, and click
**Publish**; do the same for **Storage → Rules** with `storage.rules`.

After that, every button this build touched should actually persist data:
Save, Add Column, Add Task, Export, Share, and reminders/notifications.

**How to tell if this is really it:** open the browser DevTools console
while clicking any of those buttons. This build now surfaces the real
Firebase error in the on-screen toast too (e.g. *"Could not save the task:
permission denied — your Firestore security rules need to allow this."*)
instead of failing silently — if you see `permission-denied` anywhere,
you haven't deployed the rules yet.

## The `functions/` folder

That's a separate piece — a Firebase Cloud Functions backend (Node,
CommonJS, deployed via the Firebase CLI) that sends reminder
push/SMS/WhatsApp notifications using Twilio. It already has its own
`functions/package.json`. To use it:
```bash
cd functions
npm install
```
and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
`TWILIO_WHATSAPP_FROM` as Cloud Functions environment config/secrets before
deploying. It's independent of the frontend bug above.
