import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, getBookletAuthToken } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const current = auth.currentUser;
  try {
    if (current && current.isAnonymous) {
      const result = await linkWithPopup(current, googleProvider);
      return result.user;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    // If link fails because credential already exists, fall back to sign-in.
    const code = (error as { code?: string })?.code || "";
    if (code.includes("credential-already-in-use") || code.includes("email-already-in-use")) {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
    throw error;
  }
}

export async function signOutBroker() {
  await signOut(auth);
  await signInAnonymously(auth);
}

export function watchAuthUser(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function authedFetch(path, options = {}) {
  const token = await getBookletAuthToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export async function startGmailOAuth(returnTo = `${window.location.pathname}?settings=assistant`) {
  const payload = await authedFetch("/api/mailbox/oauth/start", {
    method: "POST",
    body: JSON.stringify({ provider: "gmail", returnTo }),
  });
  if (!payload.url) throw new Error("OAuth URL missing");
  window.location.assign(payload.url);
}
