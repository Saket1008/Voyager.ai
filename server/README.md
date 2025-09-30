# Voyager.ai Server

## Deploying to Firebase (Functions v2 + Hosting)

Prereqs:
- Firebase CLI installed and logged in: `npm i -g firebase-tools` then `firebase login`
- Project created: `firebase projects:list` (pick your PROJECT_ID)
- In the repo root, run `firebase use <PROJECT_ID>` once.

### Configure secrets
Store Gemini API Key as a Functions secret:

```
firebase functions:secrets:set GEMINI_API_KEY --project <PROJECT_ID>
```

If using a service account JSON, set one of:
- `FIREBASE_SERVICE_ACCOUNT` (stringified JSON)
- or provide `server/serviceAccountKey.json` (not recommended for CI)

### Deploy
From repo root:

```
firebase deploy --only functions,hosting --project <PROJECT_ID>
```

This uses `server/functions.js` to export the `api` function (Express app) and rewrites `/api/**` to it. Hosting build runs `npm --prefix frontend run build` predeploy.

### Local emulate (optional)
```
firebase emulators:start --only functions,hosting
```

# Server

Environment variables:

- `PORT` (default 5000)
- `MONGODB_URI` (e.g., mongodb://127.0.0.1:27017/voyager)
- `CLIENT_ORIGIN` (e.g., http://localhost:5173)

