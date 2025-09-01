Environment & Secrets — Frontend

1) Create a local env file
   Copy `.env.example` to `.env` inside the `frontend/` folder and fill in the values.

   On Windows (PowerShell):
   ```powershell
   cd frontend
   copy .env.example .env
   notepad .env
   ```

2) How to obtain values
   - Firebase values: In Firebase Console → Project Settings → Your apps → Config. Copy `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, and optionally `measurementId`.
   - VITE_API_BASE: set to your backend URL (for local dev use `http://localhost:5000`).
   - Clerk publishable: only if you use Clerk. By default, Clerk has been removed from the app and the repo provides no-op fallbacks; only add Clerk keys if you intend to enable Clerk.

3) Security
   - Never commit `.env` to git. The repo `.gitignore` already includes `*.env`.
   - For production, set these variables in your hosting platform's environment variable UI (Vercel, Netlify, etc.) or use a secrets manager.

4) Quick verification
   - Start the frontend: `npm run dev` inside `frontend/` and open `http://localhost:5173`.
   - If Firebase is configured correctly, auth pages should allow sign-in.
