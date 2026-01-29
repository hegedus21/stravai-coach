
import { StravaActivity, StravaUpdateParams } from "../types";

export class StravaService {
  private accessToken: string | null = null;
  private readonly API_BASE = "https://www.strava.com/api/v3";

  setToken(token: string): void {
    this.accessToken = token;
  }

  async refreshAuth(): Promise<void> {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

    // In browser context, we don't have these env vars usually.
    // If we have an accessToken already (manually set), we skip refresh.
    if (!clientId || !clientSecret || !refreshToken) {
      if (this.accessToken) {
        console.warn("StravaService: No refresh credentials found, relying on manually provided Access Token.");
        return;
      }
      throw new Error("Missing Strava OAuth credentials (ID/Secret/Refresh Token). Ensure secrets are set in GitHub or provide a manual Access Token.");
    }

    try {
      const response = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Auth Refresh Failed: ${response.status} ${JSON.stringify(errData)}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
    } catch (err: any) {
      console.error("refreshAuth Error:", err);
      throw err;
    }
  }

  async getRecentActivities(perPage: number = 10): Promise<StravaActivity[]> {
    // Only attempt refresh if we don't have a token yet
    if (!this.accessToken) {
      await this.refreshAuth();
    }
    
    try {
      const response = await fetch(`${this.API_BASE}/athlete/activities?per_page=${perPage}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Strava Token Expired or Invalid (401). Please get a fresh Access Token.");
        }
        if (response.status === 403) {
          throw new Error("Insufficient Permissions (403). Your token needs 'activity:read_all' scope.");
        }
        throw new Error(`Strava Error (${response.status}): ${JSON.stringify(errorBody)}`);
      }
      
      return response.json();
    } catch (err: any) {
      if (err.message.includes("Failed to fetch")) {
        throw new Error("Network Error/CORS: The browser blocked the request to Strava. This is expected in some web environments. Try running the GitHub Action instead!");
      }
      throw err;
    }
  }

  async getHistoryForBaseline(count: number = 50): Promise<StravaActivity[]> {
    return this.getRecentActivities(count);
  }

  async updateActivity(activityId: number, params: StravaUpdateParams): Promise<void> {
    if (!this.accessToken) await this.refreshAuth();

    const response = await fetch(`${this.API_BASE}/activities/${activityId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Update failed (${response.status}): ${JSON.stringify(error)}`);
    }
  }
}
