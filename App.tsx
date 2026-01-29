
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import React from 'react';
import { StravaService } from './services/stravaService';
import { GeminiCoachService, QuotaExhaustedError } from './services/geminiService';
import { GoalSettings } from './types';
import { StravAILogo } from './components/Icon';

const SYNC_INTERVAL_MS = 60000;

const App: React.FC = () => {
  const [token, setToken] = useState<string>(localStorage.getItem('strava_token') || '');
  const [isActive, setIsActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSetup, setShowSetup] = useState(!token);
  const [nextSyncIn, setNextSyncIn] = useState(SYNC_INTERVAL_MS / 1000);
  const [quotaExhausted, setQuotaExhausted] = useState(localStorage.getItem('quota_exhausted_date') === new Date().toDateString());
  const [generatedIcon] = useState<string | null>(localStorage.getItem('custom_icon'));

  const [goals, setGoals] = useState<GoalSettings>({
    raceType: localStorage.getItem('goal_race_type') || 'Marathon',
    raceDate: localStorage.getItem('goal_race_date') || '2025-10-12',
    goalTime: localStorage.getItem('goal_race_time') || '3:30:00'
  });
  
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'error' | 'ai' | 'warning'; time: string }[]>([]);
  const [stats, setStats] = useState({ checked: 0, updated: 0, lastRun: 'Never' });
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stravaService = useMemo(() => new StravaService(), []);
  const coachService = useMemo(() => new GeminiCoachService(), []);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'ai' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ id, msg, type, time }, ...prev].slice(0, 100));
  }, []);

  const handleQuotaError = useCallback(() => {
    const today = new Date().toDateString();
    setQuotaExhausted(true);
    setIsActive(false);
    localStorage.setItem('quota_exhausted_date', today);
    addLog("CRITICAL: Daily Gemini Quota Exhausted. System in standby until tomorrow.", "error");
  }, [addLog]);

  useEffect(() => {
    localStorage.setItem('goal_race_type', goals.raceType);
    localStorage.setItem('goal_race_date', goals.raceDate);
    localStorage.setItem('goal_race_time', goals.goalTime);
  }, [goals]);

  const runVerification = async () => {
    if (!token) return addLog("Auth Token required. Use 'SETUP' button.", "error");
    if (quotaExhausted) return addLog("Cannot verify: Quota exhausted.", "error");
    
    setIsVerifying(true);
    addLog("Manual trigger: forcing re-analysis of latest activity...", "info");
    stravaService.setToken(token);
    
    try {
      const activities = await stravaService.getRecentActivities(10);
      const runs = activities.filter(a => a.type === 'Run');
      if (runs.length === 0) throw new Error("No recent runs found to process.");
      
      const latest = runs[0];
      addLog(`Consulting Coach Gemini for "${latest.name}"...`, "ai");
      
      const analysis = await coachService.analyzeActivity(latest, runs.slice(1), goals);
      const formattedReport = coachService.formatDescription(analysis);
      
      const cleanDesc = (latest.description || "").split("################################")[0].trim();
      const newDescription = `${cleanDesc}\n\n${formattedReport}`;

      await stravaService.updateActivity(latest.id, { description: newDescription });
      addLog(`✅ Manual Sync Successful! Activity ${latest.id} updated.`, "success");
      setStats(s => ({ ...s, updated: s.updated + 1 }));
    } catch (err: any) {
      if (err instanceof QuotaExhaustedError) {
        handleQuotaError();
      } else {
        addLog(`Sync Failed: ${err.message}`, "error");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const processSync = useCallback(async (depth: number = 20) => {
    if (!token || quotaExhausted) return;
    
    addLog(`Pulse check: scanning history...`, "info");
    stravaService.setToken(token);

    try {
      const activities = await stravaService.getRecentActivities(depth);
      setStats(s => ({ ...s, checked: s.checked + 1, lastRun: new Date().toLocaleTimeString() }));

      const runs = activities.filter(a => a.type === 'Run');
      const target = runs.find(a => !a.description?.includes("[StravAI-Processed]"));

      if (target) {
        addLog(`New run detected: "${target.name}". Executing surgical analysis...`, "ai");
        const history = runs.filter(a => a.id !== target.id);
        const analysis = await coachService.analyzeActivity(target, history, goals);
        const report = coachService.formatDescription(analysis);
        
        await stravaService.updateActivity(target.id, { 
          description: target.description ? `${target.description}\n\n${report}` : report 
        });
        
        addLog(`✅ Surgical Sync Complete: ${target.name} updated.`, "success");
        setStats(s => ({ ...s, updated: s.updated + 1 }));
      } else {
        addLog("Status: Up to date. No new activities found.", "info");
      }
    } catch (err: any) {
      if (err instanceof QuotaExhaustedError) {
        handleQuotaError();
      } else {
        addLog(`Sync Issue: ${err.message}`, "error");
      }
    }
    setNextSyncIn(SYNC_INTERVAL_MS / 1000);
  }, [token, quotaExhausted, stravaService, coachService, goals, handleQuotaError, addLog]);

  useEffect(() => {
    let interval: number | undefined;
    let countdown: number | undefined;
    
    if (isActive && !quotaExhausted) {
      processSync(20);
      interval = window.setInterval(() => processSync(20), SYNC_INTERVAL_MS);
      countdown = window.setInterval(() => {
        setNextSyncIn(prev => (prev > 0 ? prev - 1 : SYNC_INTERVAL_MS / 1000));
      }, 1000);
    } else {
      setNextSyncIn(SYNC_INTERVAL_MS / 1000);
    }
    
    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, [isActive, quotaExhausted, processSync]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-mono">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-2xl">
        <div className="flex items-center gap-4">
          <StravAILogo className="w-10 h-10" />
          <div>
            <h1 className="text-white font-bold tracking-tight uppercase">StravAI_Command_Center</h1>
            <div className="flex items-center gap-3 text-[10px] uppercase font-bold tracking-widest mt-0.5">
              <span className={`flex items-center gap-1 ${isActive ? 'text-green-400' : quotaExhausted ? 'text-red-500' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : quotaExhausted ? 'bg-red-600' : 'bg-amber-400'}`}></span>
                {quotaExhausted ? 'QUOTA_DEPLETED' : isActive ? `Polling_Active (T-${nextSyncIn}s)` : 'Polling_Idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            disabled={isVerifying || quotaExhausted}
            onClick={runVerification}
            className={`px-4 py-2 text-xs font-bold border rounded-md transition-all ${
              isVerifying || quotaExhausted ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-white/5 border-white/10 hover:bg-white/10 text-cyan-400'
            }`}
          >
            {isVerifying ? 'PROCESSING...' : quotaExhausted ? 'LOCKED' : 'SYNC_NOW'}
          </button>
          <button 
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 text-xs font-bold border border-slate-700 rounded-md hover:bg-slate-800 transition-all text-orange-400"
          >
            OPS_MANUAL
          </button>
          <button 
            disabled={quotaExhausted}
            onClick={() => setIsActive(!isActive)}
            className={`px-6 py-2 rounded-md font-bold text-xs transition-all ${
              quotaExhausted ? 'bg-slate-800 text-slate-600 border border-slate-700 opacity-50' :
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
          {quotaExhausted && (
            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-[10px] text-red-400 leading-tight">
              <p className="font-bold mb-1 underline">QUOTA DEPLETED</p>
              The 20-request daily limit is reached. The system is in safe-mode. Manual and auto-syncs are disabled until Google resets your counter (usually at 00:00 PST).
            </div>
          )}
          
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
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">System_Telemetry</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Pulses:</span><span>{stats.checked}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Analyses:</span><span className="text-[#FC6100] font-bold">{stats.updated}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Last_Sync:</span><span className="text-slate-400">{stats.lastRun}</span></div>
            </div>
          </div>
        </div>

        <div className="flex-grow flex flex-col bg-[#020617] relative">
          <div ref={logContainerRef} className="flex-grow overflow-y-auto p-6 space-y-1 text-[11px] font-mono leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-slate-700 italic opacity-50 uppercase tracking-widest text-[9px] animate-pulse">Initializing StravAI secure session... awaiting pulse.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-4">
                  <span className="text-slate-800 shrink-0 font-bold select-none">[{log.time}]</span>
                  <span className={`
                    ${log.type === 'success' ? 'text-green-400' : ''}
                    ${log.type === 'error' ? 'text-red-400' : ''}
                    ${log.type === 'ai' ? 'text-cyan-400' : ''}
                    ${log.type === 'info' ? 'text-slate-500' : ''}
                    ${log.type === 'warning' ? 'text-amber-400' : ''}
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
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6 text-sm">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white mb-1 uppercase tracking-tighter">Maintenance & Operations Guide</h2>
                <p className="text-slate-400 text-xs">Understanding your StravAI automation engine.</p>
              </div>
              <button onClick={() => setShowSetup(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-amber-400 font-bold uppercase text-xs tracking-widest">A. Future Operation</h3>
                  <p className="text-slate-300 text-xs leading-relaxed">The system works in <strong>Surgical Mode</strong>. It only analyzes the single latest run that hasn't been processed. This keeps you under the 20-request/day limit easily.</p>
                  <p className="text-slate-300 text-xs leading-relaxed">The <strong>GitHub Action</strong> runs every hour automatically in the background. You don't need to keep this tab open for the cloud sync to work.</p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-widest">B. Token Maintenance</h3>
                  <p className="text-slate-300 text-xs leading-relaxed"><strong>Access Tokens</strong> (pasted below) expire every 6 hours. Use these for temporary browser monitoring.</p>
                  <p className="text-slate-300 text-xs leading-relaxed"><strong>Refresh Tokens</strong> (saved in GitHub Secrets) are permanent. The GitHub Action uses them to self-refresh, making the cloud sync 100% maintenance-free.</p>
                </section>
              </div>

              <div className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-blue-400 font-bold uppercase text-xs tracking-widest">C. Manual Triggers</h3>
                  <p className="text-slate-300 text-xs leading-relaxed"><strong>In this UI:</strong> Click the "SYNC_NOW" button to immediately analyze your last run.</p>
                  <p className="text-slate-300 text-xs leading-relaxed"><strong>In GitHub:</strong> Go to the "Actions" tab → "StravAI Headless Sync" → click "Run workflow". This forces a cloud cycle.</p>
                </section>

                <section className="space-y-3 p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <h3 className="text-orange-500 font-bold uppercase text-xs tracking-widest mb-2">Browser Access Token</h3>
                  <div className="flex gap-2">
                    <input 
                      type="password" 
                      placeholder="Paste temporary access token..." 
                      className="flex-grow bg-slate-900 border border-slate-700 rounded p-2 text-xs outline-none focus:border-orange-500"
                      onChange={(e) => {
                        setToken(e.target.value);
                        localStorage.setItem('strava_token', e.target.value);
                      }}
                      value={token}
                    />
                    <button onClick={() => setShowSetup(false)} className="bg-orange-600 text-white px-4 py-2 rounded font-bold text-xs uppercase">Save</button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 italic">Note: Only required if you want to use the web-based monitoring dashboard.</p>
                </section>
              </div>
            </div>

            <button 
              onClick={() => setShowSetup(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors border border-slate-600 uppercase text-xs tracking-widest"
            >
              RETURN_TO_COMMAND_CENTER
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-2 bg-slate-900 border-t border-slate-800 text-[9px] text-slate-600 flex justify-between uppercase">
        <span>StravAI.OS v1.5.0 (SURGICAL_DAEMON_READY)</span>
        <span className="flex items-center gap-4">
           <span className="text-slate-500">API_QUOTA: {quotaExhausted ? '0/20' : 'ACTIVE'}</span>
           <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${token ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            {token ? 'Browser_Auth_Valid' : 'Browser_Auth_Missing'}
          </span>
        </span>
      </div>
    </div>
  );
};

export default App;
