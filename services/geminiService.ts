
import { GoogleGenAI, Type } from "@google/genai";
import { StravaActivity, AIAnalysis, GoalSettings } from "../types";

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
    const maxRetries = 3;
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
      1. Classify: Easy, Tempo, Long Run, Intervals, Threshold.
      2. Performance Summary: 2-3 sentences analyzing efficiency.
      3. Trend Assessment: How does this fit into the last 30 days? Are we overtraining or peaking?
      4. Long-term Progress: Based on the baseline, has the aerobic threshold improved?
      5. Goal Alignment: Score 1-100 how effectively this session serves the ${goals.raceType} goal.
      6. Next Prescription: Recommend the specific next workout.

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
        const isTransient = err.status === 503 || err.status === 429 || err.message?.includes("overloaded");
        
        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 2000;
          console.warn(`Gemini API busy (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to get analysis after multiple retries.");
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
