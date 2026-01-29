# StravAI Coach 🏃‍♂️🤖

StravAI is an automated performance analysis service that uses the Strava API and Google Gemini AI to provide professional coaching insights and training prescriptions directly in your activity descriptions.

## 🌟 Key Features

- **Surgical Analysis:** Only processes the single most recent activity per run to respect Gemini's free tier limits (20 requests/day).
- **Deep Context:** Analyzes current performance against a baseline of up to 50 past activities.
- **Next-Step Prescriptions:** Suggests specific workouts (intervals, tempo, recovery) based on your race goals.
- **Dual Mode:** Runs as a headless cloud service (GitHub Actions) or as a live monitoring dashboard (Command Center).
- **Circuit Breaker:** Automatically detects quota exhaustion and enters standby mode to prevent errors.

---

## 🚀 Setup Guide

### 1. Strava API Configuration
1. Go to your [Strava API Settings](https://www.strava.com/settings/api).
2. Note your **Client ID** and **Client Secret**.
3. Generate a **Refresh Token** with `activity:read_all` and `activity:write` scopes. 
   *(Use a tool like the Strava OAuth helper or curl to exchange your authorization code for a refresh token).*

### 2. Gemini API Configuration
1. Obtain an API Key from the [Google AI Studio](https://aistudio.google.com/).
2. This project uses `gemini-3-flash-preview` for high-speed, structured JSON analysis.

### 3. GitHub Automation (Headless Mode)
To let the coach work 24/7 without your computer being on:
1. Fork/Copy this repository.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add the following **Secrets**:
   - `GEMINI_API_KEY`: Your Google AI key.
   - `STRAVA_CLIENT_ID`: Your Strava App ID.
   - `STRAVA_CLIENT_SECRET`: Your Strava App Secret.
   - `STRAVA_REFRESH_TOKEN`: Your permanent Strava refresh token.
4. (Optional) Add **Secrets** for goals:
   - `GOAL_RACE_TYPE`: e.g., "Marathon"
   - `GOAL_RACE_DATE`: e.g., "2025-10-12"
   - `GOAL_RACE_TIME`: e.g., "3:30:00"

---

## 🎮 Operations Manual

### Surgical Mode
To stay within the free tier, the system is designed to be "surgical."
- **Scan:** It looks at your last 50 activities.
- **Detect:** It finds the first activity that doesn't have the `[StravAI-Processed]` signature.
- **Analyze:** It processes **only that one activity**.
- **Result:** This ensures you only use 1 request per sync, allowing up to 20 syncs per day.

### Manual Triggers
- **Immediate Analysis:** If you just finished a run and want the analysis *now*, open the **Command Center** UI and click **SYNC_NOW**.
- **GitHub Force Run:** Go to the **Actions** tab in your repo, select "StravAI Headless Sync," and click **Run workflow**.

### Maintenance & Tokens
- **Headless Mode:** **0 Maintenance.** The GitHub Action uses your `Refresh Token` to automatically generate a fresh `Access Token` every hour.
- **Command Center (Browser):** Strava `Access Tokens` expire every 6 hours. If the UI shows an error, you may need to paste a fresh token from your Strava API settings.

### Quota Management
The system includes a **Circuit Breaker**. If Gemini returns a "Quota Exhausted" error:
1. The **Command Center** will turn red and disable the "Start Daemon" button.
2. The **Headless Sync** will terminate gracefully.
3. Operation will resume automatically the next day when Google resets your quota.

---

## 🛠 Tech Stack
- **AI:** Google Gemini API (`@google/genai`)
- **Frontend:** React, Tailwind CSS (Command Center UI)
- **Backend:** TypeScript, GitHub Actions (Headless Sync)
- **Data:** Strava API v3

---

*Disclaimer: StravAI is an experimental tool. Always consult a medical professional before starting a new training intensity or program.*
