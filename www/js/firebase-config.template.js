/*
 * firebase-config.js  — AUTO-GENERATED, DO NOT EDIT
 * Run `npm run build:config` to regenerate from .env
 *
 * CRITICAL: These import URLs must point to the exact same Firebase SDK
 * version across every file. Mixing versions causes duplicate-app errors.
 */
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "{{FIREBASE_API_KEY}}",
  authDomain:        "{{FIREBASE_AUTH_DOMAIN}}",
  projectId:         "{{FIREBASE_PROJECT_ID}}",
  storageBucket:     "{{FIREBASE_STORAGE_BUCKET}}",
  messagingSenderId: "{{FIREBASE_MESSAGING_SENDER_ID}}",
  appId:             "{{FIREBASE_APP_ID}}",
  measurementId:     "{{FIREBASE_MEASUREMENT_ID}}"
};

// Initialise once and export — all other modules import from here
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
