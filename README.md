# Voyager AI — Intelligent Travel Itinerary Generator

An intelligent platform that uses Generative AI to create bespoke, end-to-end travel itineraries in seconds.

This README is a complete handoff for local dev, configuration, and deployment. It’s Windows-friendly and reflects the current codebase precisely.

## Overview

- Frontend: React 18 + Vite + Tailwind + Framer Motion
- Backend: Node 18+ + Express (can run standalone or behind Firebase Functions)
- AI: Google Gemini via @google/genai (new SDK)
- Auth: Firebase Authentication (client) + Firebase Admin (server)
- Data: Firestore (user profiles, onboarding/dna)

## Project Structure

```
voyager.ai/
├── server/                    # Express backend (Node 18+)
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   ├── services/         # Business logic & AI integration
│   │   ├── middleware/       # Auth middleware (verifies Firebase ID token)
│   │   └── index.js          # Server bootstrap (loads .env.local in dev)
│   ├── functions.js          # Firebase Functions v2 wrapper (optional deploy)
│   ├── package.json
│   └── .env.local            # Local dev env (create this)
├── frontend/                  # Vite React frontend
│   ├── src/
│   │   ├── components/       # UI components (chat, itinerary, onboarding)
│   │   ├── app/              # App-level compositions
│   │   ├── context/          # Auth + Dev settings contexts
│   │   ├── lib/              # API base + Firebase client
│   │   └── styles/           # Tailwind styles
│   ├── package.json
│   └── vite.config.js
├── firebase.json              # Hosting rewrites to Functions (prod)
└── README.md
```

## Prerequisites

- Node.js 18+ (Required)
- npm (ships with Node)
- Google Gemini API key (from Google AI Studio)
- Optional: Firebase project for Auth + Firestore

## Install and Run (Windows-friendly)

1) Install dependencies at root, server, and frontend:

```powershell
npm install
npm run install-all
```

2) Configure environment files (see next section) and then start both servers:

```powershell
npm run dev
```

This runs the backend on http://localhost:5000 and the frontend on http://localhost:5173 concurrently. If ports are busy, run the port cleaner:

```powershell
npm run predev
```

To run individually:

```powershell
npm run dev:server
npm run dev:frontend
```

## Environment Configuration

The backend automatically loads server/.env.local in local dev. For CI or production, use standard environment variables or Firebase Secrets. A test script additionally reads server/.env.

### server/.env.local (create)

```env
# Core
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
# Optional. If not set, the server defaults to a robust fallback chain starting with gemini-1.5-flash-latest.
GEMINI_MODEL=gemini-1.5-flash

# Quota controls
# When false (default), chat runs locally without AI calls.
CHAT_USE_AI=false
# When true (default), the final itinerary uses AI (cached per trip signature).
ITINERARY_USE_AI=true

# Auth (Firebase Admin)
# Preferred: set JSON directly
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ...}
# Or: path to a JSON file
# FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\to\\serviceAccountKey.json
# Fallback: server/serviceAccountKey.json (if present). If none found in local dev,
# you can set AUTH_BYPASS_DEV=true to bypass auth ONLY on localhost.
AUTH_BYPASS_DEV=false
```

Notes:
- The server logs whether GEMINI_API_KEY is present and the active model at startup.
- If you’re not using Firebase locally, set AUTH_BYPASS_DEV=true to bypass token checks on localhost only. Don’t enable this in production.

### frontend/.env.local (optional but recommended)

If you want in-app sign-in with Firebase and Firestore usage:

```env
VITE_API_BASE=http://localhost:5000
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

If these are not set, the frontend runs without Firebase client; requests to /api/* will require AUTH_BYPASS_DEV=true on the server to work during local development.

## How Auth Works

- Frontend (optional): If VITE_FIREBASE_* is configured, the app initializes Firebase and obtains a Firebase ID token.
- Backend (required for protected routes): The auth middleware verifies the Firebase ID token via Firebase Admin and attaches req.user. In local-only troubleshooting scenarios, AUTH_BYPASS_DEV=true treats requests as uid="dev" on localhost.

## Runbook: Local Dev

1) Set up server/.env.local as above. Ensure GEMINI_API_KEY is set.
2) If testing without Firebase sign-in, set AUTH_BYPASS_DEV=true.
3) npm run dev to start both services.
4) Open http://localhost:5173 and go through onboarding. The app calls:
	 - POST /api/chat (local-first; AI only if CHAT_USE_AI=true)
	 - POST /api/itinerary (AI by default; cached)
	 - POST /api/suggest (AI hints for destinations)

## Scripts and Tasks

Root package.json:

- predev: kills common dev ports if occupied
- dev: runs backend and frontend concurrently
- dev:server / dev:frontend: run individually
- install-all: convenience installer for root + server + frontend
- build: builds frontend app
- start: starts server only (no dev frontend)

Frontend package.json:

- dev, build, preview, lint (Vite + ESLint)

Server package.json:

- dev: node --env-file=.env.local src/index.js
- start: node src/index.js

## API Endpoints (all JSON)

Most endpoints are auth-protected and require a Firebase ID token in the Authorization header: "Bearer <token>". When AUTH_BYPASS_DEV=true locally, localhost requests are allowed without a token.

- GET /health — Basic liveness
- POST /api/chat — Orchestrates chat flow
	- Controlled by CHAT_USE_AI (default false). When false, the server runs a deterministic stage flow without calling AI except for lightweight suggestions.
- POST /api/itinerary — Generates itinerary markdown
	- Controlled by ITINERARY_USE_AI (default true) and cached. Falls back to a deterministic itinerary if AI fails or is disabled.
- POST /api/suggest — Returns compact hints like recommended days and best months
- Other protected routes used by the app: /api/destinations, /api/feedback, /api/journeys, /api/profile, /api/whoami

## AI Integration Details

- SDK: @google/genai
- Model selection is resilient:
	- If GEMINI_MODEL is provided, it’s tried first.
	- Automatic fallbacks prefer current models: [requested, requested-latest, requested-002, gemini-2.5-flash, gemini-2.0-pro, gemini-2.0-flash, gemini-2.0-flash-lite, 1.5 variants].
	- 404/unsupported errors trigger retry with the next candidate; other errors (quota/network) stop retries.
- Caching: Itineraries are cached in-memory per normalized trip signature to reduce duplicate calls.

Quick health-check of your key (optional test):

```powershell
curl http://localhost:5000/api/diagnostics
```

This script checks the API key and model (reads server/.env, not .env.local). If needed, copy your variables to server/.env for the test.

## Frontend Highlights

- Space-themed UI with smooth motion and visuals
- Onboarding flow enhanced with:
	- Autosave/resume drafts per user; reset progress button
	- Review & confirm step before persistence
	- Inline validation and Enter-to-continue convenience
	- Clears draft after successful completion
- Chat experience that guides users through core planning info and can optionally use AI for next-step decisions
- Itinerary canvas renders AI or fallback Markdown results

## Firebase and Firestore (optional but recommended)

To enable sign-in and user data persistence:

1) Create a Firebase project.
2) Create a Web App and take the config to populate VITE_FIREBASE_* in frontend/.env.local.
3) For the server, configure one of:
	 - FIREBASE_SERVICE_ACCOUNT env with the full JSON
	 - FIREBASE_SERVICE_ACCOUNT_PATH pointing to your JSON file
	 - server/serviceAccountKey.json file (kept out of version control)
4) Ensure Firestore security rules align with your usage (see firestore.rules in repo).

## Deployment (Firebase Hosting + Functions)

- The repo includes firebase.json with rewrites to a Cloud Function named api.
- server/functions.js wraps the Express app as an onRequest v2 function.
- Configure the secret GEMINI_API_KEY in Firebase (Functions > Secrets) and any other env needed.
- Deploy with the Firebase CLI (not included as a script here). Set appropriate CLIENT_ORIGIN for your hosting domain.

## Troubleshooting

- Ports busy: run npm run predev or close apps on 5000/5173.
- CORS blocked: set CLIENT_ORIGIN in server/.env.local to include your frontend URL(s). Localhost and Firebase Hosting origins are auto-allowed.
- Missing/invalid auth token: either sign in via Firebase (frontend configured) or set AUTH_BYPASS_DEV=true for localhost-only dev.
- Gemini 404 model error: prefer -latest suffix or leave GEMINI_MODEL unset—server will try gemini-1.5-flash-latest then fall back to pro.
- High quota usage: keep CHAT_USE_AI=false; rely on in-memory itinerary cache; disable ITINERARY_USE_AI=true → false for demos with zero AI calls.
- Fresh itinerary but cache returns old: tweak any trip input (dates, destinations) or restart the server.

## Contributing

This project demonstrates modern full-stack development with:

- React/Vite frontend with advanced animations
- Express backend with clean APIs
- AI integration with Google Gemini
- Firebase Auth + Admin integration
- Production-ready patterns (rate limiting, CORS, config-driven behavior)

The codebase favors clarity and maintainability. PRs that improve DX (types, docs, tests) are welcome.

---

### Quick Start Checklist

- Node 18+ installed
- server/.env.local created with GEMINI_API_KEY and CLIENT_ORIGIN
- Optional Firebase: set VITE_FIREBASE_* (frontend) and one of FIREBASE_SERVICE_ACCOUNT envs (server)
- Run: npm run dev → open http://localhost:5173
- If unauthenticated locally, set AUTH_BYPASS_DEV=true while developing

## Submissions

Provide links to your demo video and any supplementary resources here:
srijan
- Demo video URL: <https://drive.google.com/file/d/1mvMljOi-X0RVeYlWDWW9o-eQV9YNtIQb/view?usp=sharing>
- Slide deck or document: [<add-your-doc-link-here>](CTRL_ALT_WIN_Supplementary_File.pdf)
- Deployed demo (optional): [<add-your-live-link-here>](https://voyager-ai-6a63b.web.app)

For hackathon submissions, ensure the GitHub repository is public and a tag named `SamsungPRISMGenAIHackathon2025` is pushed for the final commit. See the commands below.