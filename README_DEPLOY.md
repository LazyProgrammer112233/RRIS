# 🚀 RRIS Production Launch Checklist

Follow these steps to deploy the RRIS Engine and Frontend to a production environment.

## 1. Backend Deployment (Railway)

1.  **Repository Setup**: Ensure all sensitive files like `.env` and `service_account.json` are listed in `.gitignore`.
2.  **Railway Dashboard**:
    - Build Service: Choose the root `Dockerfile`.
    - Variable Sync: Add the following keys:
        - `GEMINI_API_KEY`: [Your Key]
        - `GOOGLE_PLACES_API_KEY`: [Your Key]
        - `PORT`: `8000`
3.  **Deployment**: Push to your main branch. Railway will build and expose the API.
4.  **Service Account**: Since `service_account.json` is ignored by Git, you must upload it directly to the Railway volume or use a `SERVICE_ACCOUNT_JSON` environment variable containing the file content.
    - *Pro Tip*: In the Railway "Settings" -> "Environment Variables", create a variable `SERVICE_ACCOUNT_JSON` and paste the entire JSON content there. `google_sheets.py` is configured to pick this up if the file is missing.

## 2. Frontend Deployment (Vercel)

1.  **Vercel Dashboard**:
    - Framework: Next.js.
    - Environment Variables:
        - `NEXT_PUBLIC_API_URL`: `https://rris-api.railway.app` (Match your Railway URL).
2.  **Build**: The `vercel.json` handles the `npm run build` and `npm install` automatically.
3.  **CORS**: Confirm `server.py` contains exactly: `https://[your-vercel-domain].vercel.app`.

## 3. Post-Launch Verification

1.  **Ping Health**: Run `python test_production.py`.
    - This script verifies that the backend is live and Playwright/Chromium is operational inside the container.
2.  **Live Audit**: Run one audit using a high-res Google Maps URL.
3.  **Sync Test**: Click the FAB to verify Google Sheets synchronization.

## 🛑 Security Audit
- [x] No `print(API_KEY)` in `vision_engine.py` or `main.py`.
- [x] `service_account.json` is in `.gitignore`.
- [x] CORS origin is hardcoded to the Vercel production URL.
- [x] API endpoint uses HTTPS.
