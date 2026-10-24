import React, { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Health check error:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-slate-200 text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
          🛒
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Shop Billing System</h1>
        <p className="text-sm text-slate-500 mt-1">Full-stack React + Node.js + Express + MySQL</p>

        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-slate-600">Backend Health:</span>
            {loading ? (
              <span className="text-amber-600 animate-pulse">Checking...</span>
            ) : health && health.success ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Connected
              </span>
            ) : (
              <span className="text-red-500 font-semibold">Offline</span>
            )}
          </div>
          {health && (
            <p className="text-xs text-slate-500 mt-2 font-mono break-all">
              {health.message}
            </p>
          )}
        </div>

        <div className="mt-6 text-xs text-slate-400">
          Phase 1: Setup Complete &bull; Initializing Auth...
        </div>
      </div>
    </div>
  );
}

export default App;
