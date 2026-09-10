import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { getMessaging, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { firebaseConfig } from './firebase-keys.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let messaging = null;
try {
  if (await isSupported()) {
    messaging = getMessaging(app);
  }
} catch (err) {
  console.warn('Firebase messaging not supported', err);
}

export { messaging };