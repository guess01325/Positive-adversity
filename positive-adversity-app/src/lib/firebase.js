import { initializeApp } from "firebase/app";
  import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

console.log("AUTH DOMAIN:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);

const app = initializeApp(firebaseConfig);

let auth;

try {
  auth = Capacitor.isNativePlatform()
    ? initializeAuth(app, {
        persistence: indexedDBLocalPersistence,
      })
    : getAuth(app);
} catch (error) {
  auth = getAuth(app);
}

export { auth };

export const db = getFirestore(app);