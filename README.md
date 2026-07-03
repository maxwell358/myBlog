# Chronicle — Blog Network

A modern, mobile-first social blogging app built with Apache Cordova, vanilla JavaScript, Tailwind CSS, and Firebase. Users can create accounts, publish posts with images, like and comment on others' posts, and follow a live real-time feed.

---

## Features

- **Authentication** — Email/password sign-up with email verification gate; sign-in, sign-out, and persistent sessions via Firebase Auth
- **Live Feed** — Real-time post stream powered by Firestore `onSnapshot`; new posts appear instantly without a page refresh
- **Create Posts** — Rich post composer with title, body, optional cover image (base64), and estimated read time
- **Likes** — Toggle like/unlike on any post; count updates in real time
- **User Profiles** — Per-user profile screen showing all their published posts
- **Continue Reading** — Locally cached "recently viewed" posts surfaced in a horizontal scroll strip
- **Search** — Client-side search bar with sticky positioning on scroll
- **Responsive UI** — Glass-morphism card design, animated gradient background, dark purple theme; adapts from mobile to widescreen

---

## Tech Stack

| Layer | Technology |
|---|---|
| App shell | Apache Cordova (browser platform) |
| UI | Vanilla JS (no framework), Tailwind CSS v3 CDN |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore |
| Email | EmailJS (contact/notification emails) |
| Hosting | Vercel (`www/` as output directory) |
| Functions | Firebase Cloud Functions (Node 20) |

---

## Project Structure

```
MyBlog/
├── www/                        # Web root — deployed by Vercel
│   ├── index.html              # Single-file SPA (~1 800 lines)
│   ├── css/
│   │   └── index.css           # Base CSS (Tailwind entry point)
│   └── js/
│       ├── firebase-config.template.js   # Template — committed to git
│       ├── firebase-config.js            # Generated — NEVER committed
│       ├── auth.js             # Firebase Auth helpers
│       └── posts.js            # Firestore CRUD + real-time feed
├── scripts/
│   └── generate-config.js      # Builds firebase-config.js from .env
├── functions/                  # Firebase Cloud Functions source
├── .env                        # Secret keys — NEVER committed
├── .env.example                # Safe reference — committed to git
├── .gitignore
├── config.xml                  # Cordova project config
├── firebase.json               # Firebase project config
├── vercel.json                 # Vercel deployment config
└── package.json
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Firebase](https://firebase.google.com/) project with **Authentication** (email/password) and **Firestore** enabled
- (Optional) [Vercel CLI](https://vercel.com/docs/cli) for local preview

### 1. Clone the repo

```bash
git clone https://github.com/your-username/MyBlog.git
cd MyBlog
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Firebase credentials

Copy the example env file and fill in your Firebase project values:

```bash
cp .env.example .env
```

Open `.env` and replace every placeholder with the values from your Firebase console:

> **Firebase Console → Project Settings → Your Apps → Web App → SDK setup and configuration**

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 4. Generate the Firebase config file

This command reads `.env` and writes the real credentials into `www/js/firebase-config.js` (which is git-ignored):

```bash
npm run build:config
```

> Re-run this step whenever you update `.env`.

### 5. Run locally

Open `www/index.html` directly in a browser, **or** use the Cordova browser platform:

```bash
npx cordova run browser
```

Or serve with any static server:

```bash
npx serve www
```

---

## Deployment

### Vercel

The project is pre-configured for Vercel. `vercel.json` sets `www/` as the output directory and rewrites all paths to `index.html` for client-side routing.

1. Push the repo to GitHub
2. Import the project in the [Vercel dashboard](https://vercel.com/new)
3. Add all environment variables from `.env` in **Project Settings → Environment Variables**
4. Set the build command to `npm run build:config` and the output directory to `www`

> Vercel injects env vars at build time, so `firebase-config.js` is generated on their servers — your keys never need to be in the repo.

### Firebase Hosting (optional)

```bash
firebase deploy --only hosting
```

---

## Security — Keeping Keys Safe

| File | Committed? | Why |
|---|---|---|
| `.env` | No | Contains real secret keys |
| `www/js/firebase-config.js` | No | Generated from `.env`; contains real keys |
| `.env.example` | Yes | Placeholder values only — safe reference for contributors |
| `firebase-config.template.js` | Yes | Contains `{{PLACEHOLDER}}` tokens, no real values |

**Firebase API keys are not truly secret** — they are embedded in every web client that talks to Firebase. Security is enforced through [Firebase Security Rules](https://firebase.google.com/docs/rules) on the Firestore and Auth side, not by hiding the key. However, keeping them out of git still:

- Prevents your key from being scraped by automated bots that harvest public repos
- Lets you rotate keys without touching the codebase
- Keeps the repo clean for open-source sharing

Make sure your Firestore Security Rules restrict read/write access to authenticated users only.

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `FIREBASE_API_KEY` | Firebase Web API key |
| `FIREBASE_AUTH_DOMAIN` | Auth domain (`project.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | Firestore project ID |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket host |
| `FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID |
| `FIREBASE_APP_ID` | Web App ID |
| `FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID |

---

## Scripts

| Command | Description |
|---|---|
| `npm run build:config` | Generate `www/js/firebase-config.js` from `.env` |

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.
