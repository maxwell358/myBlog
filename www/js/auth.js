/*
 * auth.js
 * Handles all Firebase Authentication operations:
 *   handleSignUp  — create account + send verification email
 *   handleSignIn  — login with email/password + verify email gate
 *   handleSignOut — destroy current session
 *
 * CRITICAL: All user-facing messages go through window.showToast()
 * (defined in index.html). Do NOT replace with alert() — it blocks
 * the main thread and breaks mobile web views.
 */
import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  reload
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * handleSignUp
 * Creates a new Firebase user account, attaches the display name,
 * sends a verification email, then signs out so the user must verify
 * before they can access the app.
 *
 * CRITICAL ORDER OF OPERATIONS:
 *   1. createUserWithEmailAndPassword — creates the Auth record
 *   2. updateProfile(displayName)     — must happen BEFORE sign-out so
 *      displayName is saved; used for bloggerName on every post
 *   3. sendEmailVerification          — dispatches the confirmation link
 *   4. signOut                        — forces user back to login;
 *      they cannot access the app until the email link is clicked
 *   5. onSuccess()                    — caller navigates to login view
 */
export async function handleSignUp(email, password, fullName, onSuccess) {
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user       = credential.user;

    // Attach display name — without this bloggerName will be null in every post
    await updateProfile(user, { displayName: fullName.trim() });

    // Dispatch verification email
    await sendEmailVerification(user);

    // Sign out immediately — dashboard is gated on emailVerified === true
    await signOut(auth);

    window.showToast('Account created! Check your email to verify before signing in.', 'success', 6000);
    onSuccess();
  } catch (error) {
    window.showToast(`Sign up failed: ${_friendlyError(error.code)}`, 'error');
  }
}

/**
 * handleSignIn
 * Signs the user in and enforces the email-verification security gate.
 *
 * KEY FIX: We call reload(user) to get a fresh token from the server
 * before reading emailVerified. Firebase caches the user object locally,
 * so without reload() a user who just clicked the verification link would
 * still see emailVerified === false until the page refreshes.
 *
 * We only call signOut() if the login itself succeeded but the email is
 * not verified — NOT on a credential error (400). Calling signOut() on a
 * failed login triggers onAuthStateChanged unnecessarily and causes the
 * auth screen to flash/reset.
 *
 * CRITICAL SECURITY CHECK: Even if Firebase Auth allows the login, we
 * block access here if emailVerified is false. Without this an unverified
 * account could read/write Firestore data.
 */
export async function handleSignIn(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user       = credential.user;

    // Reload the user from the server to get the latest emailVerified status.
    // This is critical for users who just clicked their verification link —
    // the locally cached token won't reflect the change until we reload.
    await reload(user);

    if (!user.emailVerified) {
      // Login succeeded but email not verified — block and sign back out
      await signOut(auth);
      window.showToast(
        'Email not verified yet. Check your inbox and click the verification link.',
        'error',
        6000
      );
      return;
    }

    // Verified — onAuthStateChanged in index.html will route to dashboard automatically
    window.showToast('Welcome back!', 'success', 2500);

  } catch (error) {
    // 400 / invalid-credential means wrong email or password — do NOT call signOut here.
    // The user was never signed in so there is nothing to sign out of.
    window.showToast(`Sign in failed: ${_friendlyError(error.code)}`, 'error');
  }
}

/**
 * handleSignOut
 * Destroys the current Firebase Auth session.
 * CRITICAL: After this call, onAuthStateChanged fires with null which
 * routes the user back to the login screen automatically.
 */
export async function handleSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    window.showToast(`Sign out error: ${error.message}`, 'error');
  }
}

/**
 * _friendlyError (private)
 * Maps Firebase error codes to readable human messages.
 * Prevents raw internal codes like "auth/invalid-credential" from
 * surfacing to users.
 */
function _friendlyError(code) {
  const map = {
    'auth/email-already-in-use':   'That email is already registered.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with that email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/too-many-requests':      'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/user-disabled':          'This account has been disabled.',
  };
  return map[code] || 'An unexpected error occurred. Please try again.';
}
