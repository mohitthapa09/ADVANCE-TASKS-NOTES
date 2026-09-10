# ATN Workspace

A task and notes web app. You sign in, get a dashboard with a Kanban board, a notes section, reminders, and the option to share your work or export it as PDF/DOCX. No build tools, no framework — just HTML, CSS and JavaScript talking to Firebase.

## What it does

- Sign in with email/password or phone number + OTP
- Kanban board — add columns, add tasks, drag and drop them between columns
- Notes with a rich text editor (bold, lists, links, etc.)
- Dashboard with an activity chart showing what you've been doing
- Reminders and notifications — in-app, push, and optionally SMS/WhatsApp
- Export notes or boards to PDF or Word (.docx)
- Share a note or board with a link

## Technology used

- **Frontend:** HTML, CSS, vanilla JavaScript (ES modules)
- **Backend / database:** Firebase (Authentication, Firestore, Storage, Cloud Messaging)
- **Serverless functions:** Firebase Cloud Functions (Node.js) for sending reminders through Twilio (SMS/WhatsApp)
- **Libraries used in the browser:** Quill (text editor), Chart.js (dashboard chart), SortableJS (drag and drop), html2pdf.js and docx.js (exporting files), JSZip

## Project structure

```
ATN Workspace/
├── index.html                        Sign-in page (email or phone + OTP)
├── signup.html                       Sign-up page
├── dashboard.html                    Main app shell — loads dashboard, notes, kanban views
├── share.html                        Public page for viewing a shared note/board
│
├── assets/
│   ├── css/style.css                 All styling for the app
│   ├── icons/atn.svg                 App logo
│   └── js/
│       ├── app.js                    Entry point — boots the app, loads the right view
│       └── utils.js                  Shared helper functions
│
├── components/                       One file per UI section
│   ├── auth.js                       Sign-in logic (email/password + phone OTP)
│   ├── signup.js                     Sign-up form logic
│   ├── navbar.js                     Top navigation bar
│   ├── sidebar.js                    Side menu / view switcher
│   ├── dashboard.js                  Dashboard view + activity chart
│   ├── notes.js                      Notes view (Quill rich text editor)
│   ├── kanban.js                     Kanban board — columns, tasks, drag & drop
│   ├── notifications.js              In-app notifications / reminders UI
│   └── share.js                      "Share" modal and link generation
│
├── firebase/
│   ├── config.js                     Initializes the Firebase app
│   ├── firebase-keys.js              Your real Firebase project keys (git-ignored)
│   ├── firebase-keys.example.js      Template showing what firebase-keys.js should look like
│   ├── auth.js                       Firebase Authentication wrapper functions
│   ├── firestore.js                  Firestore read/write helper functions
│   ├── storage.js                    Firebase Storage upload/download helpers
│   └── messaging.js                  Firebase Cloud Messaging (push notifications) setup
│
├── services/                         Feature logic that sits above the raw Firebase calls
│   ├── export.js                     Turns a note/board into PDF or DOCX
│   ├── share.js                      Creates and resolves shareable links
│   ├── whatsapp.js                   Sends WhatsApp reminders (calls the Cloud Function)
│   └── Twilio.js                     Sends SMS reminders (calls the Cloud Function)
│
├── functions/                        Firebase Cloud Functions backend (deployed separately)
│   ├── index.js                      Scheduled/triggered functions that send reminders via Twilio
│   └── package.json                  Backend dependencies (firebase-admin, firebase-functions, twilio)
│
├── public/
│   └── firebase-messaging-sw.js      Service worker required for push notifications
│
├── firestore.rules                   Who can read/write what in Firestore
├── storage.rules                     Who can read/write files in Storage
├── firestore.indexes.json            Composite indexes Firestore needs for some queries
├── firebase.json                     Firebase project config (which files map to which service)
└── .gitignore                        Keeps firebase-keys.js and other local files out of git
```

## How to run it

1. **Get a Firebase project.**
   Go to the [Firebase Console](https://console.firebase.google.com), create a project (or use one you already have), then add a Web App to it. Firebase will show you a `firebaseConfig` object — copy it.

2. **Add your keys.**
   Open `firebase/firebase-keys.js` and paste your real values in. There's a `firebase/firebase-keys.example.js` file you can look at as a template if you need to recreate it. This file is git-ignored on purpose, so your keys never get pushed to GitHub.

3. **Turn on the Firebase services you need**, from the left sidebar of the console:
   - **Authentication** → Sign-in method → enable Email/Password (and Phone, if you want OTP login)
   - **Firestore Database** → Create database
   - **Storage** → Get started
   - **Cloud Messaging** (optional, only for push notifications) → generate a Web Push certificate and paste it into `firebase-keys.js` as `vapidKey`

4. **Deploy the security rules.**
   Without this, every save/add/export/share action will silently fail. Either:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```
   or just open Firestore/Storage → Rules in the console and paste in the contents of `firestore.rules` / `storage.rules` yourself.

5. **Serve the files.** This is a static site, so any local server works:
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
   Then set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` and `TWILIO_WHATSAPP_FROM` in your Cloud Functions config before deploying, if you want SMS/WhatsApp reminders to go out.

## What I learned

- How Firebase Authentication, Firestore and Storage fit together in a real app, not just a toy example — sign-in, saving data, and file uploads all had to be wired to the same project.
- How security rules actually work. I assumed once the code called `setDoc()` or `getDocs()` it would just work, but Firestore denies everything by default until you write rules that allow it.
- How to structure a no-framework project so it doesn't turn into spaghetti — splitting the UI into one file per feature in `components/` made this much easier to manage than one giant script.
- How to send notifications outside the browser (SMS/WhatsApp) using Cloud Functions and Twilio, instead of everything happening client-side.

## Problems I faced and how I solved them

**Sign in button did nothing.**
The console showed an error trying to read `import.meta.env.VITE_FIREBASE_API_KEY`. That's a Vite-only feature, and this project isn't built with Vite — it's plain HTML/JS. Because the broken import was at the top of the auth module, the whole script crashed before any click listeners were even attached, so nothing on the page responded. Fixed by reading the Firebase config from a plain JS file (`firebase-keys.js`) instead.

**Save, Add Task, Add Column, Export and Share all failed silently.**
Turned out there was no `firestore.rules` file in the project, so Firestore was running on its default (deny everything, or a 30-day test mode that had expired). Every database call was being rejected with a permission error, but the app wasn't showing that error anywhere, so it just looked broken. Fixed by writing proper `firestore.rules` / `storage.rules` and deploying them, and by making the app show the real Firebase error in a toast message instead of failing quietly.

**Reminders and the activity chart stayed empty.**
Same root cause as above — no data was ever getting written to Firestore in the first place, so there was nothing to show. Once the rules were deployed, both started working.

## License

Personal project.