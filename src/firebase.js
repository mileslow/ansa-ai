import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

let authPromise;

export function getBookletAuthToken() {
  if (!authPromise) {
    authPromise = new Promise((resolve, reject) => {
      let settled = false;
      const unsubscribe = onAuthStateChanged(
        auth,
        async (user) => {
          if (settled) return;
          try {
            const activeUser = user || (await signInAnonymously(auth)).user;
            settled = true;
            unsubscribe();
            resolve(activeUser);
          } catch (error) {
            settled = true;
            unsubscribe();
            reject(error);
          }
        },
        (error) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          reject(error);
        },
      );
    });
  }
  return authPromise.then((user) => user.getIdToken());
}
