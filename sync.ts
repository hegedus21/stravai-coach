
import { StravaService } from './services/stravaService';
import { GeminiCoachService } from './services/geminiService';
import { GoalSettings } from './types';

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
    
    // Fetch a large history to give AI a sense of fitness level/trends
    const allRecent = await strava.getHistoryForBaseline(50);
    const runs = allRecent.filter(a => a.type === 'Run');

    if (runs.length === 0) {
      console.log("No runs found in the last 50 activities.");
      return;
    }

    // Identify the absolute latest run
    const latestRun = runs[0];
    const signature = "[StravAI-Processed]";

    if (latestRun.description?.includes(signature)) {
      console.log(`Latest run "${latestRun.name}" already has AI coaching. Checking for other unprocessed runs...`);
    }

    // Process unprocessed runs starting from the most recent
    for (const activity of runs) {
      if (activity.description?.includes(signature)) continue;

      console.log(`Processing: "${activity.name}" (${new Date(activity.start_date).toLocaleDateString()})`);
      
      // History context: everything EXCEPT the one being analyzed
      const contextHistory = runs.filter(a => a.id !== activity.id);
      
      const analysis = await coach.analyzeActivity(activity, contextHistory, goals);
      const formattedReport = coach.formatDescription(analysis);

      const newDescription = activity.description 
        ? `${activity.description}\n\n${formattedReport}`
        : formattedReport;

      await strava.updateActivity(activity.id, { description: newDescription });
      console.log(`✅ AI Coach updated activity: ${activity.id}`);
      
      // For the very first run (most recent), we stop here if we only want to update one at a time, 
      // but usually processing all new ones is better.
    }

    console.log("--- Sync Complete ---");
  } catch (error) {
    console.error("Sync Failure:", error);
    process.exit(1);
  }
}

runSync();
