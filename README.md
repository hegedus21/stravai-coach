# StravAI Coach 🏃‍♂️🤖

StravAI is an automated performance analysis service that uses the Strava API and Google Gemini AI to provide professional coaching insights and training prescriptions directly in your activity descriptions.

## 🌟 Key Features

- **Surgical Analysis:** Only processes the single most recent activity per run to respect Gemini's free tier limits (20 requests/day).
- **Deep Context:** Analyzes current performance against a baseline of up to 50 past activities.
- **Next-Step Prescriptions:** Suggests specific workouts (intervals, tempo, recovery) based on your race goals.
- **Dual Mode:** Runs as a headless cloud service (GitHub Actions) or as a live monitoring dashboard (Command Center).
- **Circuit Breaker:** Automatically detects quota exhaustion and enters standby mode.

---

## 💰 Is it Free? (Free Tier Breakdown)
This service is designed to run at **zero cost** by utilizing the following free tiers:

| Provider | Service | Free Limit | StravAI Usage |
| :--- | :--- | :--- | :--- |
| **Google** | Gemini AI | ~1,500 req/day (Flash) | **1 req** per run |
| **Strava** | Developer API | 1,000 req/day | **~2-5 req** per hour |
| **GitHub** | Actions | 2,000 min/mo (Private) | **~360 min** per month |
| **GitHub** | Pages | Unlimited (Public) | **Static hosting** |

---

## 🚀 Setup Guide

### 1. Strava API Configuration
1. Go to your [Strava API Settings](https://www.strava.com/settings/api).
2. Note your **Client ID** and **Client Secret**.
3. Generate a **Refresh Token** with `activity:read_all` and `activity:write` scopes.

### 2. GitHub Automation (Headless Mode)
This runs the "Engine" in the cloud every hour:
1. Go to **Settings > Secrets and variables > Actions**.
2. Add the following **Secrets**:
   - `GEMINI_API_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`.
   - Optional: `GOAL_RACE_TYPE`, `GOAL_RACE_DATE`, `GOAL_RACE_TIME`.

### 3. 🌐 Web UI Hosting (GitHub Pages)
You can host the **Command Center** dashboard directly on GitHub:
1. Go to your repository **Settings > Pages**.
2. Under **Build and deployment > Source**, select **"GitHub Actions"**.
3. Push a change to `main`. GitHub will automatically deploy the UI.
4. Access it at: `https://<your-username>.github.io/<repo-name>/`

---

## 🎮 Operations Manual

### Surgical Mode
To stay within the free tier, the system only processes **one activity per run**. This ensures you only use 1 request per sync, allowing up to 20 syncs per day.

### Manual Triggers
- **Web Dashboard:** Click **SYNC_NOW** in the Command Center.
- **GitHub Force Run:** Go to **Actions** -> "StravAI Headless Sync" -> **Run workflow**.

### 🔒 Security & Privacy
- **Headless Mode:** Uses GitHub Secrets (Encrypted/Private). This is where your permanent Refresh Token lives.
- **Web UI:** Since the UI is public, it **cannot** access your GitHub Secrets. You must paste a temporary **Access Token** into the UI manually. This token is stored only in your browser's `localStorage` and expires after 6 hours.

### Quota Management
If Gemini returns a "Quota Exhausted" error, the system enters **Standby Mode**. Operation will resume automatically the next day when Google resets your quota.

---

## 🛠 Tech Stack
- **AI:** Google Gemini API (`@google/genai`)
- **Frontend:** React, Tailwind CSS (Command Center UI)
- **Backend:** TypeScript, GitHub Actions (Headless Sync)
- **Data:** Strava API v3

---

*Disclaimer: StravAI is an experimental tool. Always consult a medical professional before starting a new training intensity or program.*
