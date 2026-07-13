import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed.private_key)
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

export function getAdminServices() {
  const configured = serviceAccount();
  const app =
    getApps()[0] ||
    initializeApp({
      credential: configured ? cert(configured) : applicationDefault(),
      projectId:
        process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  return {
    db: getFirestore(app),
    bucket: getStorage(app).bucket(),
  };
}
