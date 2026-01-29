
import { GoogleGenAI, Type } from "@google/genai";
import { StravaActivity, AIAnalysis, GoalSettings } from "../types";

export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExhaustedError";
  }
}

export class GeminiCoachService {
  constructor() {}

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async analyzeActivity(
    activity: StravaActivity, 
    history: StravaActivity[], 
    goals: GoalSettings
  ): Promise<AIAnalysis> {
    const maxRetries = 5;
    let attempt = 0;

    const historySummary = (list: StravaActivity[]) => list
      .map(h => `- ${h.type} (${new Date(h.start_date).toLocaleDateString()}): ${(h.distance/1000).toFixed(2)}km, Pace: ${((h.moving_time/60)/(h.distance/1000)).toFixed(2)} min/km, HR: ${h.average_heartrate || '?'}`)
      .join("\n");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recent30Days = history.filter(h => new Date(h.start_date) > thirtyDaysAgo);
    const deepBaseline = history.slice(0, 50);

    const prompt = `
      ROLE: Professional Athletic Performance Coach.
      ATHLETE GOAL: ${goals.raceType} on ${goals.raceDate} (Target: ${goals.goalTime}).
      
      ANALYSIS TARGET (Current Activity):
      - Name: ${activity.name}
      - Distance: ${(activity.distance / 1000).toFixed(2)} km
      - Moving Time: ${(activity.moving_time / 60).toFixed(1)} mins
      - Avg HR: ${activity.average_heartrate ?? 'N/A'} bpm
      
      CONTEXT A: RECENT TRENDS (Last 30 Days)
      ${historySummary(recent30Days)}

      CONTEXT B: DEEP BASELINE (Up to 1 Year / 50 Activities)
      ${historySummary(deepBaseline)}

      TASK:
      1. Classify the workout type.
      2. Provide a summary analysis (2-3 sentences).
      3. Assess current training trends.
      4. Compare against long-term baseline.
      5. Score effectiveness (1-100).
      6. Prescribe the next workout.

      OUTPUT: JSON only.
    `;

    while (attempt < maxRetries) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                activityClassification: { type: Type.STRING, enum: ['Easy', 'Tempo', 'Long Run', 'Intervals', 'Threshold', 'Other'] },
                effectivenessScore: { type: Type.NUMBER },
                pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                trendImpact: { type: Type.STRING },
                nextTrainingSuggestion: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    distance: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    description: { type: Type.STRING },
                    targetMetrics: { type: Type.STRING }
                  },
                  required: ["type", "distance", "duration", "description", "targetMetrics"]
                }
              },
              required: ["summary", "activityClassification", "effectivenessScore", "pros", "cons", "trendImpact", "nextTrainingSuggestion"]
            }
          }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from Gemini");
        return JSON.parse(text);
      } catch (err: any) {
        attempt++;
        const errStr = err.message?.toLowerCase() || "";
        
        // Check for Hard Quota Exceeded (Daily Limit)
        if (errStr.includes("quota exceeded") || errStr.includes("resource_exhausted")) {
          console.error("CRITICAL: Gemini Daily Quota Exceeded. Circuit breaker active.");
          throw new QuotaExhaustedError("Daily API Quota Exceeded. Please try again tomorrow.");
        }

        const isTransient = err.status === 503 || 
                          err.status === 429 || 
                          errStr.includes("overloaded") || 
                          errStr.includes("unavailable") ||
                          errStr.includes("busy");
        
        if (isTransient && attempt < maxRetries) {
          const retryMatch = err.message?.match(/retry in ([\d.]+)s/i);
          const delaySeconds = retryMatch ? parseFloat(retryMatch[1]) + 1 : Math.pow(2, attempt) * 3;
          const delayMs = Math.min(delaySeconds * 1000, 60000);
          
          console.warn(`[Gemini API] Temporary Busy. Retry ${attempt}/${maxRetries} in ${delayMs}ms...`);
          await this.sleep(delayMs);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Maximum retries reached for Gemini API.");
  }

  formatDescription(analysis: AIAnalysis): string {
    const border = "################################";
    return `
${border}
Strava AI analysis
---
**Coach's Summary:**
[${analysis.activityClassification}] ${analysis.summary}

**Effectiveness Score:** ${analysis.effectivenessScore}/100
${analysis.pros.map(p => `+ ${p}`).join('\n')}

**Trend & Progress:**
${analysis.trendImpact}

**Next Training Suggestion:**
- **Type:** ${analysis.nextTrainingSuggestion.type}
- **Volume:** ${analysis.nextTrainingSuggestion.distance} | ${analysis.nextTrainingSuggestion.duration}
- **Target Metrics:** ${analysis.nextTrainingSuggestion.targetMetrics}
- **Focus:** ${analysis.nextTrainingSuggestion.description}

*[StravAI-Processed]*
${border}
    `.trim();
  }
}
