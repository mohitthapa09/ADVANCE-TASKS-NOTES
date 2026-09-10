import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db, auth } from './config.js';

export {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  getDocs,
  db
};

export const upsertUserProfile = async (user) => {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  const data = {
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
    photoURL: user.photoURL || '',
    phoneNumber: user.phoneNumber || '',
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    data.createdAt = serverTimestamp();
    data.roles = { member: true };
  }
  await setDoc(ref, data, { merge: true });
  return ref;
};

export const createRecord = async (collectionName, data) => {
  const ref = doc(collection(db, collectionName));
  await setDoc(ref, {
    ...data,
    id: ref.id,
    uid: auth.currentUser?.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref;
};