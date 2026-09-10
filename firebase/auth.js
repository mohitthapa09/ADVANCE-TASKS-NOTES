import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

import { auth } from './config.js';

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signOut,
  auth
};

export const getProvider = (name) => {
  switch (name) {
    case 'google':
      return new GoogleAuthProvider();
    case 'github':
      return new GithubAuthProvider();
    case 'facebook':
      return new FacebookAuthProvider();
    case 'apple':
      return new OAuthProvider('apple.com');
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
};