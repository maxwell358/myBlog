/*
 * firebase-config.js
 * Initialises the Firebase app and exports the three core services:
 *   auth — Firebase Authentication
 *   db   — Firestore database
 *
 * CRITICAL: These import URLs must point to the exact same Firebase SDK
 * version across every file. Mixing versions causes duplicate-app errors.
 */
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase project credentials — do not commit to a public repo
const firebaseConfig = {
  apiKey:            "AIzaSyA3Y430HZ0JZ8n8eBw9csWadYecyCjvoWo",
  authDomain:        "blog-e25c5.firebaseapp.com",
  projectId:         "blog-e25c5",
  storageBucket:     "blog-e25c5.firebasestorage.app",
  messagingSenderId: "515957528950",
  appId:             "1:515957528950:web:7ac513052bad08b1370257",
  measurementId:     "G-LZQ4521QMY"
};

// Initialise once and export — all other modules import from here
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
