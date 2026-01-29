
import { StravaService } from './services/stravaService';
import { GeminiCoachService, QuotaExhaustedError } from './services/geminiService';
import { GoalSettings } from './types';

async function runSync() {
  console.log("--- Starting StravAI Surgical Sync ---");
  
  const goals: GoalSettings = {
    raceType: process.env.GOAL_RACE_TYPE || "Marathon",
    raceDate: process.env.GOAL_RACE_DATE || "Not Set",
    goalTime: process.env.GOAL_RACE_TIME || "Finish"
  };

  const strava = new StravaService();
  const coach = new GeminiCoachService();

  try {
    await strava.refreshAuth();
    console.log(`Target Goal: ${goals.raceType} | Date: ${goals.raceDate}`);
    
    console.log("Fetching athlete history for baseline context...");
    const history = await strava.getHistoryForBaseline(50);
    const runs = history.filter(a => a.type === 'Run');

    if (runs.length === 0) {
      console.log("No runs found in history.");
      return;
    }

    const signature = "[StravAI-Processed]";
    const activityToProcess = runs.find(a => !a.description?.includes(signature));

    if (!activityToProcess) {
      console.log("All recent activities are already analyzed. Nothing to do.");
      return;
    }

    console.log(`Target Found: "${activityToProcess.name}" (${new Date(activityToProcess.start_date).toLocaleDateString()})`);
    const contextHistory = runs.filter(a => a.id !== activityToProcess.id);
    
    try {
      console.log("Consulting Coach Gemini...");
      const analysis = await coach.analyzeActivity(activityToProcess, contextHistory, goals);
      const formattedReport = coach.formatDescription(analysis);

      const newDescription = activityToProcess.description 
        ? `${activityToProcess.description}\n\n${formattedReport}`
        : formattedReport;

      await strava.updateActivity(activityToProcess.id, { description: newDescription });
      console.log(`✅ Success: Activity ${activityToProcess.id} updated with AI analysis.`);
    } catch (innerError: any) {
      if (innerError instanceof QuotaExhaustedError) {
        console.error("STOPPING SYNC: Gemini Free Tier Quota Exhausted for today.");
        process.exit(0); // Exit gracefully as this is a known limit
      }
      console.error(`Failed to analyze activity ${activityToProcess.id}: ${innerError.message}`);
    }

    console.log(`--- Sync Cycle Complete ---`);
  } catch (error) {
    console.error("Critical Sync Failure:", error);
    process.exit(1);
  }
}

runSync();
