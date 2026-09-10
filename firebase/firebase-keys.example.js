// ⚠️ Local, machine-specific Firebase credentials.
// This file is listed in .gitignore — it will NOT be committed.
// Copy the values from: Firebase Console → Project settings → General → Your apps → SDK setup and configuration.
//
// If you haven't created a Firebase project yet:
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or select an existing one)
// 3. Click the "</>" (Web) icon to register a web app
// 4. Copy the firebaseConfig values it gives you into the object below
// 5. In the left sidebar enable: Authentication (Email/Password + any OAuth
//    providers you use), Firestore Database, and Storage.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // optional, only if you enabled Analytics
};

// Optional: only needed if you want push notifications (firebase/messaging.js).
// Firebase Console → Project settings → Cloud Messaging → Web configuration → Web Push certificates.
export const vapidKey = "YOUR_VAPID_KEY";
