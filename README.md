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

## 🔒 Security & Privacy FAQ

### "If I make this repo public, are my keys safe?"
**Yes.** GitHub Secrets (Settings > Secrets > Actions) are encrypted. No one can see them—not even you after saving. They are only injected into the background sync process and are hidden in all logs.

### "Can strangers change my code?"
**No.** Public means "Read-Only" for the world. Only you have "Write" access. Others can only suggest changes via Pull Requests, which you must approve.

### "Is my Strava data private?"
The **Headless Sync** runs privately in GitHub's cloud. The **Web UI** only shows your data in *your* browser because you paste *your* token there. Other people visiting your GitHub Pages URL will see an empty dashboard because they don't have your token.

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

---

## 🛠 Tech Stack
- **AI:** Google Gemini API (`@google/genai`)
- **Frontend:** React, Tailwind CSS (Command Center UI)
- **Backend:** TypeScript, GitHub Actions (Headless Sync)
- **Data:** Strava API v3

## Idea by @hegedus21

---

*Disclaimer: StravAI is an experimental tool. Always consult a medical professional before starting a new training intensity or program.*
