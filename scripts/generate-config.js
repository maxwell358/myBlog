#!/usr/bin/env node
/**
 * generate-config.js
 * Reads .env and injects values into firebase-config.template.js,
 * writing the result to www/js/firebase-config.js.
 *
 * Usage: npm run build:config
 */

const fs   = require("fs");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REQUIRED = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
  "FIREBASE_MEASUREMENT_ID",
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing required env vars:", missing.join(", "));
  process.exit(1);
}

const templatePath = path.resolve(__dirname, "../www/js/firebase-config.template.js");
const outputPath   = path.resolve(__dirname, "../www/js/firebase-config.js");

let content = fs.readFileSync(templatePath, "utf8");

for (const key of REQUIRED) {
  content = content.replaceAll(`{{${key}}}`, process.env[key]);
}

fs.writeFileSync(outputPath, content, "utf8");
console.log("Generated www/js/firebase-config.js from .env");
