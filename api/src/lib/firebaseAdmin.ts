import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function privateKey(): string {
  const raw = requiredEnv("FIREBASE_PRIVATE_KEY");
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: privateKey(),
    }),
  });
}

export const db = getFirestore();
