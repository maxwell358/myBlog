/*
 * posts.js
 * Handles all Firestore post operations:
 *   initLiveFeed      — real-time stream subscription
 *   handleCreatePost  — submit new post document
 *   processImageFile  — convert file to base64 + preview
 *   clearSelectedImage — reset staged image state
 */
import { db, auth } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * selectedImageBase64
 * Module-level state holding the current base64-encoded image string.
 * CRITICAL: This must be module-level (not function-local) so that
 * processImageFile can write to it asynchronously via FileReader,
 * and handleCreatePost can read it when the form is submitted later.
 */
export let selectedImageBase64 = null;

/**
 * clearSelectedImage
 * Resets the staged image — called when navigating away from compose
 * screen or after a successful post to prevent stale data on next post.
 * CRITICAL: Always call this when leaving the create-post screen.
 */
export function clearSelectedImage() {
  selectedImageBase64 = null;
}

/**
 * initLiveFeed
 * Opens a real-time Firestore listener that streams the posts collection
 * ordered newest-first (descending by createdAt timestamp).
 *
 * CRITICAL: Returns the unsubscribe function from onSnapshot.
 * The caller (index.html) MUST store this and call it on navigation
 * to avoid orphaned listeners that continue firing after the feed
 * DOM is destroyed — causing silent errors and memory/bandwidth waste.
 *
 * NOTE: The orderBy("createdAt", "desc") query requires a composite
 * Firestore index. If you see an index error in the console, click the
 * link Firebase provides in the error — it creates the index automatically.
 *
 * @param  {Function} callback - called with each Firestore QuerySnapshot
 * @returns {Function} unsubscribe — call to stop the listener
 */
export function initLiveFeed(callback) {
  const postsQuery = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  // onSnapshot fires immediately with current data, then on every change
  return onSnapshot(postsQuery, callback, (error) => {
    console.error("Firestore stream error:", error);
    window.showToast("Feed sync error. Check your connection.", "error");
  });
}

/**
 * handleCreatePost
 * Validates inputs, builds the post document according to the required
 * data architecture, and writes it to Firestore.
 *
 * CRITICAL DATA FIELDS — removing any of these breaks downstream features:
 *   title       — displayed as the card headline
 *   content     — full post body, also used for the preview truncation
 *   image       — base64 string; must be ≤ ~1MB or Firestore will reject
 *   createdAt   — serverTimestamp() prevents client clock spoofing and
 *                 is required by the orderBy query in initLiveFeed
 *   bloggerId   — the Firebase Auth UID; used for ownership/security rules
 *   bloggerName — displayName at post time; shown on the card author line
 *
 * @param {string}   title     - post title from form input
 * @param {string}   content   - post body from textarea
 * @param {Function} onSuccess - callback invoked after successful write
 */
export async function handleCreatePost(title, content, onSuccess) {
  const user = auth.currentUser;

  // Session guard — should not happen if auth routing is correct
  if (!user) {
    window.showToast("Session expired. Please sign in again.", "error");
    return;
  }

  if (!title.trim()) {
    window.showToast("Please add a title before publishing.", "error");
    return;
  }

  if (!content.trim()) {
    window.showToast("Post content cannot be empty.", "error");
    return;
  }

  try {
    const postDocument = {
      title:       title.trim(),
      content:     content.trim(),
      createdAt:   serverTimestamp(),        // Firestore server time — prevents spoofing
      bloggerId:   user.uid,                // Firebase Auth UID — used in security rules
      bloggerName: user.displayName || "Anonymous Blogger"
    };
    if (selectedImageBase64) postDocument.image = selectedImageBase64;

    await addDoc(collection(db, "posts"), postDocument);

    // Notify subscribers in the background — don't block the success flow
    sendNewPostNotifications(user.uid, user.displayName || "Anonymous Blogger", title.trim(), content.trim())
      .catch(err => console.error("Notification error:", err));

    // Reset staged image after successful publish
    clearSelectedImage();
    onSuccess();
  } catch (error) {
    console.error("Post creation error:", error);
    window.showToast(`Publishing failed: ${error.message}`, "error");
  }
}

/**
 * processImageFile
 * Reads a File object with FileReader, converts it to a base64 data URI,
 * stores it in selectedImageBase64, and updates the preview <img> element.
 *
 * PERFORMANCE PROTECTION: Firestore documents have a hard 1MB size limit.
 * We enforce an 800KB file size cap here to leave room for other fields.
 * Without this guard, large images will cause addDoc() to throw a quota error.
 *
 * CRITICAL: The previewImgId parameter must match the id of an <img> element
 * already in the DOM when this function runs — typically 'post-preview'.
 *
 * onReady callback — called after selectedImageBase64 is set AND the preview
 * image src has been assigned. The caller uses this to toggle visibility of
 * the preview wrapper and picker UI. Keeping the toggle here (rather than
 * attaching a 'load' event on the <img> from outside) eliminates the race
 * condition where src is set before the external listener is attached.
 * CRITICAL: Do NOT call onReady on error paths — it must only fire on success.
 *
 * @param {File}       file         - image File from input[type=file] change event
 * @param {string}     previewImgId - id of the <img> element to update with preview
 * @param {Function}   [onReady]    - optional callback fired after src is set successfully
 */
export function processImageFile(file, previewImgId, onReady = null) {
  if (!file) return;

  // 800 000 bytes ≈ 800KB — Firestore 1MB document limit safety buffer
  if (file.size > 800_000) {
    window.showToast("Image too large. Please choose a photo under 800KB.", "error");
    return; // onReady is NOT called — preview must stay hidden
  }

  const reader = new FileReader();

  reader.onloadend = () => {
    // Store the base64 result for later use by handleCreatePost
    selectedImageBase64 = reader.result;

    // Update the preview image if the element exists in the DOM
    const previewEl = document.getElementById(previewImgId);
    if (previewEl) {
      previewEl.src = selectedImageBase64;
    }

    // Notify caller that the image is staged and preview src is set.
    // Called here (inside onloadend) to avoid the race condition of attaching
    // a 'load' listener on the img element after src is already assigned.
    onReady?.();
  };

  reader.onerror = () => {
    window.showToast("Failed to read image file. Please try again.", "error");
    // onReady is NOT called — preview must stay hidden on read failure
  };

  // readAsDataURL produces a base64-encoded data URI ready for Firestore storage
  reader.readAsDataURL(file);
}

/**
 * handleEditPost
 * Updates the title and content of an existing post document in Firestore.
 *
 * @param {string}   postId   - Firestore document ID
 * @param {string}   title    - new title value
 * @param {string}   content  - new content value
 * @param {Function} onSuccess - callback after successful write
 */
export async function handleEditPost(postId, title, content, onSuccess) {
  const user = auth.currentUser;
  if (!user) {
    window.showToast("Session expired. Please sign in again.", "error");
    return;
  }
  if (!title.trim()) {
    window.showToast("Title cannot be empty.", "error");
    return;
  }
  if (!content.trim()) {
    window.showToast("Content cannot be empty.", "error");
    return;
  }
  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      title:     title.trim(),
      content:   content.trim(),
      updatedAt: serverTimestamp()
    });
    window.showToast("Post updated successfully!", "success");
    onSuccess();
  } catch (error) {
    console.error("Edit post error:", error);
    window.showToast(`Update failed: ${error.message}`, "error");
  }
}

/**
 * handleDeletePost
 * Permanently removes a post document from Firestore.
 *
 * @param {string}   postId    - Firestore document ID
 * @param {Function} onSuccess - callback after successful delete
 */
export async function handleDeletePost(postId, onSuccess) {
  const user = auth.currentUser;
  if (!user) {
    window.showToast("Session expired. Please sign in again.", "error");
    return;
  }
  try {
    await deleteDoc(doc(db, "posts", postId));
    onSuccess();
  } catch (error) {
    console.error("Delete post error:", error);
    window.showToast(`Delete failed: ${error.message}`, "error");
  }
}

/**
 * sendNewPostNotifications
 * Queries all posts by the blogger, collects every unique subscriber email,
 * and sends a notification via EmailJS for each one.
 * Called in the background after a successful post creation — does not block UI.
 *
 * @param {string} bloggerId   - Firebase Auth UID of the post author
 * @param {string} bloggerName - Display name of the author
 * @param {string} title       - Title of the new post
 * @param {string} content     - Body of the new post (used for preview)
 */
async function sendNewPostNotifications(bloggerId, bloggerName, title, content) {
  console.log("[Notify] Starting notification for blogger:", bloggerId);

  // Collect all unique subscriber emails across all posts by this blogger
  const postsSnap = await getDocs(
    query(collection(db, "posts"), where("bloggerId", "==", bloggerId))
  );

  console.log("[Notify] Posts found for this blogger:", postsSnap.size);

  const emailSet = new Set();
  postsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    console.log("[Notify] Post subscribers:", data.subscribers);
    if (Array.isArray(data.subscribers)) {
      data.subscribers.forEach(email => emailSet.add(email.toLowerCase().trim()));
    }
  });

  console.log("[Notify] Total unique subscribers:", emailSet.size, [...emailSet]);

  if (emailSet.size === 0) {
    console.log("[Notify] No subscribers found — skipping email send.");
    return;
  }

  const preview = content.length > 250
    ? content.slice(0, 250).trimEnd() + "…"
    : content;

  // Check emailjs is available
  if (typeof emailjs === "undefined") {
    console.error("[Notify] emailjs is not loaded on window!");
    return;
  }

  // Send one email per subscriber
  const sends = [...emailSet].map(email => {
    console.log("[Notify] Sending to:", email);
    return emailjs.send("service_7pum5cb", "template_x4i7o58", {
      to_email:     email,
      blogger_name: bloggerName,
      post_title:   title,
      post_preview: preview
    });
  });

  const results = await Promise.allSettled(sends);
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log("[Notify] Sent OK:", r.value);
    else console.error("[Notify] Send FAILED:", r.reason);
  });
}

/**
 * handleSubscribeEmail
 * Adds a subscriber email to the post document's `subscribers` array
 * using Firestore arrayUnion to avoid duplicates.
 *
 * @param {string}   postId  - Firestore document ID
 * @param {string}   email   - subscriber email address
 * @param {Function} onSuccess - callback after successful write
 */
/**
 * incrementViewCount
 * Increments the viewCount field on a post document by 1.
 * Uses sessionStorage to ensure each post is only counted once per browser session.
 *
 * @param {string} postId - Firestore document ID
 */
export async function incrementViewCount(postId) {
  const sessionKey = `viewed_${postId}`;
  if (sessionStorage.getItem(sessionKey)) return; // already counted this session
  sessionStorage.setItem(sessionKey, '1');
  try {
    await updateDoc(doc(db, "posts", postId), { viewCount: increment(1) });
  } catch (error) {
    // Silent fail — view count is non-critical
    console.warn("View count update failed:", error.message);
  }
}

/**
 * toggleLike
 * Adds or removes the current user's UID from the post's `likedBy` array.
 * If the user has already liked the post, their UID is removed (unlike).
 * Otherwise it is added (like). The live feed snapshot will propagate the
 * updated count back to all cards automatically.
 *
 * @param {string}   postId   - Firestore document ID
 * @param {string[]} likedBy  - current likedBy array from the post document
 */
export async function toggleLike(postId, likedBy = []) {
  const user = auth.currentUser;
  if (!user) {
    window.showToast("Sign in to like posts.", "error");
    return;
  }
  const postRef = doc(db, "posts", postId);
  const hasLiked = likedBy.includes(user.uid);
  try {
    await updateDoc(postRef, {
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  } catch (error) {
    console.warn("Like update failed:", error.message);
  }
}

export async function handleSubscribeEmail(postId, email, onSuccess) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    window.showToast("Please enter a valid email address.", "error");
    return;
  }
  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      subscribers: arrayUnion(email.trim().toLowerCase())
    });
    window.showToast("You're subscribed for future updates!", "success");
    onSuccess();
  } catch (error) {
    console.error("Subscribe error:", error);
    window.showToast(`Subscription failed: ${error.message}`, "error");
  }
}
