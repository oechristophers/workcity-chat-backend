import path from "path";
import { fileURLToPath } from "url";

// Firebase Admin SDK initialization (optional). Will no-op if env vars missing or dependency absent.
type AppType = any;
let firebaseApp: AppType | null = null;

// Find the project root to locate the service account key
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(
  __dirname,
  "..",
  "..",
  "firebase-service-account.json"
);

export const getFirebaseApp = async (): Promise<AppType | null> => {
  if (firebaseApp) return firebaseApp;

  try {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const fs = await import("fs");

    if (!fs.existsSync(serviceAccountPath)) {
      console.warn(
        "Firebase Service Account key not found at:",
        serviceAccountPath
      );
      console.warn("Firebase features will be disabled.");
      return null;
    }

    if (!getApps().length) {
      firebaseApp = initializeApp({
        credential: cert(serviceAccountPath),
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET || "chat-app-3c875.appspot.com",
      });
    } else {
      firebaseApp = getApps()[0];
    }

    return firebaseApp;
  } catch (e) {
    console.error("Firebase Admin SDK initialization error", e);
    return null;
  }
};

export const uploadBufferToFirebase = async (
  path: string,
  buffer: Buffer,
  contentType?: string
) => {
  const app = await getFirebaseApp();
  if (!app) {
    // Placeholder fallback
    return { url: `https://placeholder.local/${encodeURIComponent(path)}` };
  }

  try {
    const { getStorage } = await import("firebase-admin/storage");
    const bucket = getStorage(app).bucket();
    const file = bucket.file(path);
    await file.save(buffer, { contentType, resumable: false, public: true });
    await file.makePublic();
    return { url: file.publicUrl() };
  } catch (e) {
    console.error("Firebase upload error", e);
    return { url: `https://placeholder.local/${encodeURIComponent(path)}` };
  }
};
