/*
 * functions/index.js
 *
 * Firebase Cloud Function: notifySubscribersOnNewPost
 *
 * Triggers when a new document is created in the "posts" collection.
 * Collects all unique subscriber emails across every post by that blogger,
 * then sends a notification email via Gmail using Nodemailer.
 *
 * SETUP REQUIRED (run once before deploying):
 *   firebase functions:secrets:set GMAIL_USER   ← your Gmail address
 *   firebase functions:secrets:set GMAIL_PASS   ← Gmail App Password (not your real password)
 *
 * To generate a Gmail App Password:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Go to myaccount.google.com → Security → App Passwords
 *   3. Create a new App Password and paste it when prompted above
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }       = require("firebase-admin/firestore");
const nodemailer             = require("nodemailer");

initializeApp();

// Secrets are stored encrypted in Google Secret Manager — never in source code
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_PASS = defineSecret("GMAIL_PASS");

exports.notifySubscribersOnNewPost = onDocumentCreated(
  {
    document: "posts/{postId}",
    secrets:  [GMAIL_USER, GMAIL_PASS],
    region:   "us-central1"
  },
  async (event) => {
    const postData = event.data.data();

    // Skip if required fields are missing (e.g. malformed document)
    if (!postData || !postData.bloggerId || !postData.title) {
      console.log("Skipping notification: missing bloggerId or title.");
      return null;
    }

    const { title, content = "", bloggerId, bloggerName = "A blogger" } = postData;
    const db = getFirestore();

    // ── 1. Collect all subscriber emails from every post by this blogger ────
    const postsSnap = await db
      .collection("posts")
      .where("bloggerId", "==", bloggerId)
      .get();

    const emailSet = new Set();
    postsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (Array.isArray(data.subscribers)) {
        data.subscribers.forEach((email) => {
          if (typeof email === "string" && email.includes("@")) {
            emailSet.add(email.toLowerCase().trim());
          }
        });
      }
    });

    if (emailSet.size === 0) {
      console.log("No subscribers found for blogger:", bloggerId);
      return null;
    }

    // ── 2. Build the email ──────────────────────────────────────────────────
    const preview = content.length > 250
      ? content.slice(0, 250).trimEnd() + "…"
      : content;

    const htmlBody = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale:1.0"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <!-- Header bar -->
              <tr>
                <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
                  <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Chronicle</p>
                  <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(title)}</h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:28px 32px;">
                  <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">${escapeHtml(preview)}</p>
                  <p style="margin:0;color:#9ca3af;font-size:13px;">Published by <strong style="color:#6d28d9;">${escapeHtml(bloggerName)}</strong></p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">
                    You're receiving this because you subscribed to updates from ${escapeHtml(bloggerName)}.
                  </p>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // ── 3. Send via Gmail SMTP ──────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),
        pass: GMAIL_PASS.value()
      }
    });

    await transporter.sendMail({
      from:    `"${bloggerName}" <${GMAIL_USER.value()}>`,
      bcc:     [...emailSet].join(","),   // BCC keeps subscriber addresses private
      subject: `New post: ${title}`,
      html:    htmlBody
    });

    console.log(`Notified ${emailSet.size} subscriber(s) for post "${title}" by ${bloggerName}`);
    return null;
  }
);

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
