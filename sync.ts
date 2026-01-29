
import { StravaService } from './services/stravaService';
import { GeminiCoachService } from './services/geminiService';
import { GoalSettings } from './types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runSync() {
  console.log("--- Starting StravAI Coaching Sync ---");
  
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
    console.log("Building athlete baseline (fetching last 50 activities)...");
    
    const allRecent = await strava.getHistoryForBaseline(50);
    const runs = allRecent.filter(a => a.type === 'Run');

    if (runs.length === 0) {
      console.log("No runs found in the last 50 activities.");
      return;
    }

    const signature = "[StravAI-Processed]";

    for (const activity of runs) {
      if (activity.description?.includes(signature)) continue;

      console.log(`Processing: "${activity.name}" (${new Date(activity.start_date).toLocaleDateString()})`);
      
      const contextHistory = runs.filter(a => a.id !== activity.id);
      
      try {
        const analysis = await coach.analyzeActivity(activity, contextHistory, goals);
        const formattedReport = coach.formatDescription(analysis);

        const newDescription = activity.description 
          ? `${activity.description}\n\n${formattedReport}`
          : formattedReport;

        await strava.updateActivity(activity.id, { description: newDescription });
        console.log(`✅ AI Coach updated activity: ${activity.id}`);
        
        // Pause briefly between activities to avoid hitting rate limits
        console.log("Cooling down for 3 seconds...");
        await sleep(3000);
      } catch (innerError: any) {
        console.error(`Skipping activity ${activity.id} due to analysis error: ${innerError.message}`);
        // Continue to next activity instead of crashing the whole sync
      }
    }

    console.log("--- Sync Complete ---");
  } catch (error) {
    console.error("Sync Failure:", error);
    process.exit(1);
  }
}

runSync();
