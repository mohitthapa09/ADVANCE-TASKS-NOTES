import { getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';
import { messaging } from './config.js';
import { doc, updateDoc, serverTimestamp } from './firestore.js';
import { db } from './config.js';
import { auth } from './config.js';
import { vapidKey } from './firebase-keys.js';

export const requestPermissionAndGetToken = async () => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, { vapidKey });

    if (token && auth.currentUser) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        fcmToken: token,
        updatedAt: serverTimestamp()
      });
    }
    return token;
  } catch (err) {
    console.error('FCM token error', err);
    return null;
  }
};

export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};