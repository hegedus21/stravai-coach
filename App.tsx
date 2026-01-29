
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import React from 'react';
import { GoogleGenAI } from "@google/genai";
import { StravaService } from './services/stravaService';
import { GeminiCoachService } from './services/geminiService';
import { GoalSettings } from './types';
import { StravAILogo } from './components/Icon';

const SYNC_INTERVAL_MS = 60000;

const App: React.FC = () => {
  const [token, setToken] = useState<string>(localStorage.getItem('strava_token') || '');
  const [isActive, setIsActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSetup, setShowSetup] = useState(!token);
  const [generatedIcon, setGeneratedIcon] = useState<string | null>(localStorage.getItem('custom_icon'));

  const [goals, setGoals] = useState<GoalSettings>({
    raceType: localStorage.getItem('goal_race_type') || 'Marathon',
    raceDate: localStorage.getItem('goal_race_date') || '2025-10-12',
    goalTime: localStorage.getItem('goal_race_time') || '3:30:00'
  });
  
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'error' | 'ai'; time: string }[]>([]);
  const [stats, setStats] = useState({ checked: 0, updated: 0, lastRun: 'Never' });
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stravaService = useMemo(() => new StravaService(), []);
  const coachService = useMemo(() => new GeminiCoachService(), []);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'ai' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ id, msg, type, time }, ...prev].slice(0, 100));
  };

  useEffect(() => {
    localStorage.setItem('goal_race_type', goals.raceType);
    localStorage.setItem('goal_race_date', goals.raceDate);
    localStorage.setItem('goal_race_time', goals.goalTime);
  }, [goals]);

  const runVerification = async () => {
    if (!token) return addLog("Auth Token required. Use 'SETUP' button.", "error");
    setIsVerifying(true);
    addLog("Starting Deployment Verification...", "info");
    stravaService.setToken(token);
    
    try {
      const activities = await stravaService.getRecentActivities(50);
      const runs = activities.filter(a => a.type === 'Run');
      if (runs.length === 0) throw new Error("No runs found to verify.");
      
      const latest = runs[0];
      addLog(`Forcing re-analysis of latest run: ${latest.name}...`, "ai");
      
      const analysis = await coachService.analyzeActivity(latest, runs.slice(1), goals);
      const formattedReport = coachService.formatDescription(analysis);
      
      const cleanDesc = (latest.description || "").split("################################")[0].trim();
      const newDescription = `${cleanDesc}\n\n${formattedReport}`;

      await stravaService.updateActivity(latest.id, { description: newDescription });
      addLog(`✅ Verification Successful! Activity ${latest.id} updated.`, "success");
      setStats(s => ({ ...s, updated: s.updated + 1 }));
    } catch (err: any) {
      addLog(`Verification Failed: ${err.message}`, "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const processSync = useCallback(async (depth: number = 20) => {
    if (!token) return;
    addLog(`Auto-Sync Pulse (History Depth: ${depth})...`, "info");
    stravaService.setToken(token);

    try {
      const activities = await stravaService.getRecentActivities(depth);
      setStats(s => ({ ...s, checked: s.checked + 1, lastRun: new Date().toLocaleTimeString() }));

      const runs = activities.filter(a => a.type === 'Run');
      for (const activity of runs) {
        if (activity.description?.includes("[StravAI-Processed]")) continue;

        addLog(`Found new activity: ${activity.name}. Processing...`, "ai");
        const analysis = await coachService.analyzeActivity(activity, runs.filter(a => a.id !== activity.id), goals);
        const report = coachService.formatDescription(analysis);
        
        await stravaService.updateActivity(activity.id, { 
          description: activity.description ? `${activity.description}\n\n${report}` : report 
        });
        
        addLog(`✅ Auto-processed: ${activity.name}`, "success");
        setStats(s => ({ ...s, updated: s.updated + 1 }));
      }
    } catch (err: any) {
      addLog(`Sync Warning: ${err.message}`, "error");
    }
  }, [token, stravaService, coachService, goals]);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      processSync(20);
      interval = window.setInterval(() => processSync(20), SYNC_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [isActive, processSync]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-mono">
      <div className="hidden">
        <StravAILogo className="brand-logo-svg" />
      </div>

      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-2xl">
        <div className="flex items-center gap-4">
          {generatedIcon ? (
            <img src={generatedIcon} alt="Logo" className="w-10 h-10 rounded-lg border border-orange-500/30" />
          ) : (
            <StravAILogo className="w-10 h-10" />
          )}
          <div>
            <h1 className="text-white font-bold tracking-tight uppercase">StravAI_Command_Center</h1>
            <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest mt-0.5">
              <span className={`flex items-center gap-1 ${isActive ? 'text-green-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></span>
                {isActive ? 'Polling_Active' : 'Polling_Idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            disabled={isVerifying}
            onClick={runVerification}
            className={`px-4 py-2 text-xs font-bold border rounded-md transition-all ${
              isVerifying ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-white/5 border-white/10 hover:bg-white/10 text-cyan-400'
            }`}
          >
            {isVerifying ? 'VERIFYING...' : 'VERIFY_SYNC'}
          </button>
          <button 
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 text-xs font-bold border border-slate-700 rounded-md hover:bg-slate-800 transition-all text-orange-400"
          >
            SETUP_GUIDE
          </button>
          <button 
            onClick={() => setIsActive(!isActive)}
            className={`px-6 py-2 rounded-md font-bold text-xs transition-all ${
              isActive 
              ? 'bg-red-500/10 text-red-500 border border-red-500/50' 
              : 'bg-green-500/10 text-green-500 border border-green-500/50'
            }`}
          >
            {isActive ? 'STOP_DAEMON' : 'START_DAEMON'}
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col md:flex-row min-h-0 overflow-hidden">
        <div className="w-full md:w-80 border-r border-slate-800 bg-slate-900/50 p-6 space-y-8 overflow-y-auto">
          <div>
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Training_Parameters</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Race</label>
                <input type="text" value={goals.raceType} onChange={e => setGoals({...goals, raceType: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-orange-500"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Target Date</label>
                <input type="date" value={goals.raceDate} onChange={e => setGoals({...goals, raceDate: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-orange-500"/>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Pace/Time Goal</label>
                <input type="text" value={goals.goalTime} onChange={e => setGoals({...goals, goalTime: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-orange-500"/>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Sync_Stats</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Cycles:</span><span>{stats.checked}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Updates:</span><span className="text-[#FC6100] font-bold">{stats.updated}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Uptime:</span><span className="text-slate-400">{stats.lastRun}</span></div>
            </div>
          </div>
        </div>

        <div className="flex-grow flex flex-col bg-[#020617] relative">
          <div ref={logContainerRef} className="flex-grow overflow-y-auto p-6 space-y-1 text-[11px] font-mono leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-slate-700 italic opacity-50 uppercase tracking-widest text-[9px] animate-pulse">Initializing StravAI secure session...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-4">
                  <span className="text-slate-800 shrink-0 font-bold select-none">[{log.time}]</span>
                  <span className={`
                    ${log.type === 'success' ? 'text-green-400' : ''}
                    ${log.type === 'error' ? 'text-red-400' : ''}
                    ${log.type === 'ai' ? 'text-cyan-400' : ''}
                    ${log.type === 'info' ? 'text-slate-500' : ''}
                  `}>
                    <span className="text-slate-800 mr-2 select-none">$</span>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6 text-sm">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1 uppercase tracking-tighter">Action_Fix_Applied_v1.2.4</h2>
                <p className="text-slate-400 text-xs">We updated the sync engine to <code className="text-white">tsx</code> to fix the Import error.</p>
              </div>
              <button onClick={() => setShowSetup(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>

            <section className="space-y-4">
              <h3 className="text-red-400 font-bold uppercase text-xs tracking-widest">CRITICAL: Update your code</h3>
              <p className="text-slate-300">The error "Cannot use import statement outside a module" means Node was confused. We fixed this by switching the runner to use <code className="text-cyan-400">tsx</code>.</p>
              
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <p className="text-[10px] text-slate-500 uppercase font-bold">1. Check your package.json on GitHub:</p>
                <code className="block bg-black p-2 rounded text-green-500 text-[10px] overflow-x-auto">
                  "type": "module",<br/>
                  "scripts": &#123; "sync": "npx tsx sync.ts" &#125;
                </code>
                
                <p className="text-[10px] text-slate-500 uppercase font-bold mt-4">2. Check your .github/workflows/sync.yml:</p>
                <code className="block bg-black p-2 rounded text-green-500 text-[10px] overflow-x-auto">
                  - run: npm install<br/>
                  - run: npm run sync
                </code>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-orange-400 font-bold uppercase text-xs tracking-widest">3. Relaunching</h3>
              <p className="text-slate-400">Once those two files are updated on GitHub, go back to <strong>Actions</strong> and click <strong>Run Workflow</strong> again. The error will be gone.</p>
            </section>

            <section className="space-y-2 pt-4 border-t border-slate-800">
              <h3 className="text-blue-400 font-bold uppercase text-xs tracking-widest">Need to check locally?</h3>
              <p className="text-slate-400 text-xs">If you want to run this monitor console, paste your Strava Access Token below.</p>
              <div className="flex gap-2">
                <input 
                  type="password" 
                  placeholder="Access Token..." 
                  className="flex-grow bg-slate-950 border border-slate-800 rounded p-2 text-xs outline-none focus:border-orange-500"
                  onChange={(e) => {
                    setToken(e.target.value);
                    localStorage.setItem('strava_token', e.target.value);
                  }}
                  value={token}
                />
                <button onClick={() => setShowSetup(false)} className="bg-orange-600 text-white px-4 py-2 rounded font-bold text-xs uppercase">Save_Local</button>
              </div>
            </section>

            <button 
              onClick={() => setShowSetup(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors border border-slate-600 uppercase text-xs tracking-widest"
            >
              DISMISS_AND_UPDATE_GITHUB
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-2 bg-slate-900 border-t border-slate-800 text-[9px] text-slate-600 flex justify-between uppercase">
        <span>StravAI.OS v1.2.4 (ENGINE_FIX_LOADED)</span>
        <span className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${token ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          {token ? 'Local_Monitor_Standby' : 'Waiting_for_Token'}
        </span>
      </div>
    </div>
  );
};

export default App;
