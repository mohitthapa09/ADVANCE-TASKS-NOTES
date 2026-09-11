# ATN Workspace (Advance Tasks & Notes)

**Live demo:** https://advance-tasks-notes.web.app

A task-and-notes web app. You sign in, land on a dashboard, and from there you can manage a Kanban board, write notes, get reminders, and export or share your work — all backed by Firebase. No React, no build step, just plain HTML/CSS/JavaScript talking directly to Firebase.

## What it does

- **Sign in** with email/password, phone number + OTP, or Google / GitHub / Facebook
- **Kanban board** — create columns, add tasks, drag and drop tasks between columns
- **Notes** with a rich text editor (bold, lists, links, emoji picker)
- **Dashboard** with an activity chart showing what you've been up to
- **Reminders** — set a reminder date on a task and get notified in-app, via push notification, and optionally SMS/WhatsApp
- **Export** a note or board as a PDF or Word (.docx) file
- **Share** a note or board publicly via a link

## Technology used

- **Frontend:** HTML, CSS, vanilla JavaScript (ES modules) — no framework, no bundler
- **Backend / database:** Firebase — Authentication, Firestore, Storage, Cloud Messaging
- **Serverless functions:** Firebase Cloud Functions (Node.js 20), used to send SMS/WhatsApp reminders through Twilio and to push notifications on a schedule
- **Libraries (loaded via CDN in the browser):** Quill (rich text editor), Chart.js (dashboard chart), SortableJS (drag-and-drop), html2pdf.js and docx.js (exporting files), JSZip, emoji-picker-element, Font Awesome (icons)

## Project structure

```
ATN Workspace/
├── index.html                 Sign-in page (email, phone OTP, Google/GitHub/Facebook)
├── signup.html                Sign-up page
├── dashboard.html             Main app shell — loads the dashboard, notes, and board views
├── share.html                 Public page for viewing a shared note/board
│
├── assets/
│   ├── css/style.css          All app styling
│   ├── icons/atn.svg          App logo
│   └── js/
│       ├── app.js             Entry point — boots the app and wires up the views
│       └── utils.js           Shared helper functions (toasts, formatting, etc.)
│
├── components/                One file per UI section
│   ├── auth.js                 Sign-in logic (email/password, phone OTP, OAuth)
│   ├── signup.js                Sign-up form logic
│   ├── navbar.js                 Top navigation bar
│   ├── sidebar.js                 Side menu / view switcher
│   ├── dashboard.js                Dashboard view + activity chart
│   ├── notes.js                     Notes view (Quill editor)
│   ├── tasks.js                      Kanban board — columns, tasks, drag & drop
│   ├── notifications.js               In-app notifications / reminders UI
│   └── share.js                        "Share" modal and link generation
│
├── firebase/
│   ├── config.js               Initializes the Firebase app
│   ├── firebase-keys.js        This project's Firebase config values
│   ├── auth.js                  Firebase Authentication wrapper functions
│   ├── firestore.js              Firestore read/write helper functions
│   ├── storage.js                 Firebase Storage upload/download helpers
│   └── messaging.js                Firebase Cloud Messaging (push notification) setup
│
├── services/                   Feature logic that sits above the raw Firebase calls
│   ├── export.js                Turns a note/board into a PDF or DOCX
│   ├── share.js                   Creates and resolves shareable links
│   ├── whatsapp.js                 Sends WhatsApp reminders (calls the Cloud Function)
│   └── Twilio.js                    Sends SMS reminders (calls the Cloud Function)
│
├── functions/                  Firebase Cloud Functions backend (deployed separately)
│   ├── index.js                 Pushes notifications and checks for due reminders every 5 minutes
│   └── package.json              Backend dependencies (firebase-admin, firebase-functions, twilio)
│
├── public/
│   └── firebase-messaging-sw.js  Service worker required for push notifications
│
├── firestore.rules             Who can read/write what in Firestore
├── storage.rules               Who can read/write files in Storage
├── firestore.indexes.json      Composite indexes Firestore needs for some queries
└── firebase.json                Firebase project config (maps files to services)
```

## How to run it

1. **Get a Firebase project.**
   Go to the [Firebase Console](https://console.firebase.google.com), create a project (or use an existing one), then add a Web App to it. Firebase will hand you a `firebaseConfig` object.

2. **Add your keys.**
   Open `firebase/firebase-keys.js` and replace the values with your own project's config (this repo currently has the original project's keys hard-coded here, so if you're forking it, swap these out for your own before deploying anywhere public).

3. **Turn on the Firebase services you need**, from the left sidebar of the console:
   - **Authentication** → Sign-in method → enable Email/Password, Phone, and whichever OAuth providers you want (Google, GitHub, Facebook)
   - **Firestore Database** → Create database
   - **Storage** → Get started
   - **Cloud Messaging** (optional, for push notifications) → generate a Web Push certificate and paste it into `firebase-keys.js` as `vapidKey`

4. **Deploy the security rules.**
   Without this, every save/add/export/share action fails silently. Either:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```
   or open Firestore/Storage → Rules in the console and paste in the contents of `firestore.rules` / `storage.rules` yourself.

5. **Serve the files.** It's a static site, so any local server works:
   ```bash
   npx serve .
   # or
   python3 -m http.server 5500
   ```
   Then open `index.html` in your browser.

6. **(Optional) Set up the reminder functions.**
   ```bash
   cd functions
   npm install
   ```
   Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `TWILIO_WHATSAPP_FROM` in your Cloud Functions config, then `npm run deploy`, if you want SMS/WhatsApp reminders to actually go out.

## What I learned

- How Firebase Authentication, Firestore, and Storage fit together in a real app rather than a toy example — sign-in, saving data, and file uploads all had to point at the same project and stay in sync.
- That Firestore denies everything by default. I assumed calling `setDoc()` or `getDocs()` would just work once the code was right — it doesn't, until you write rules that explicitly allow it.
- How to keep a no-framework project organized. Splitting the UI into one file per feature under `components/` kept things manageable instead of turning into one giant script.
- How to send notifications outside the browser — using a scheduled Cloud Function with Twilio for SMS/WhatsApp, instead of trying to do everything client-side.

## Problems I faced and how I solved them

**Sign-in button did nothing.**
The console showed an error trying to read an environment variable that only exists in Vite projects. This app isn't built with Vite — it's plain HTML/JS — and because that broken line sat at the top of the auth module, the whole script crashed before any click listeners were attached. Nothing on the page responded as a result. Fixed by reading the Firebase config from a plain JS file (`firebase-keys.js`) instead of an env variable.

**Save, Add Task, Add Column, Export, and Share all failed silently.**
There was no `firestore.rules` file in the project, so Firestore was running on its default deny-everything behavior. Every database call was being rejected with a permission error, but the app wasn't surfacing that error anywhere, so it just looked broken with no clue why. Fixed by writing proper `firestore.rules` / `storage.rules` and deploying them, and by making the app show the real Firebase error in a toast instead of failing quietly.

**Reminders and the dashboard's activity chart stayed empty.**
Same root cause as above — no data was ever making it into Firestore, so there was nothing to show and the chart sat flat at zero. Once the rules were deployed and writes started succeeding, both started populating correctly.

## License

Personal project.