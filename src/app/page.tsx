"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ArrowRight, Table, CheckCircle, Info, Database, Sparkles, Cpu, Layers } from 'lucide-react';
import AuditDisplay from '@/components/AuditDisplay';
import toast from 'react-hot-toast';

export default function RRISDashboard() {
  const [mapsUrl, setMapsUrl] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFeed, setStatusFeed] = useState<string[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860';
  const APP_SECRET = process.env.NEXT_PUBLIC_APP_SECRET || '';

  // Add to status feed helper
  const addStatus = (msg: string) => {
    setStatusFeed(prev => [msg, ...prev].slice(0, 5));
  };

  useEffect(() => {
    let interval: any;
    if (taskId && (status === 'PENDING' || status === 'RUNNING')) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/status/${taskId}`, {
            headers: { 'X-RRIS-SECRET': APP_SECRET },
          });
          const data = await res.json();

          if (data.status !== status) {
            setStatus(data.status);
            addStatus(`System: ${data.status}`);
          }

          if (data.status === 'COMPLETED') {
            setResult(data.result);
            setIsLoading(false);
            toast.success('Audit Intelligence Synchronized');
          } else if (data.status === 'FAILED') {
            setIsLoading(false);
            toast.error('Intelligence Retrieval Failed');
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [taskId, status, API_URL]);

  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsUrl) return;

    setIsLoading(true);
    setResult(null);
    setStatus('PENDING');
    setStatusFeed(['Initializing RRIS Engine...']);

    try {
      addStatus('Resolving Endpoint...');
      let finalUrl = mapsUrl;
      if (mapsUrl.includes("maps.app.goo.gl") || mapsUrl.includes("goo.gl")) {
        const resolveRes = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maps_url: mapsUrl })
        });
        if (resolveRes.ok) {
          const resolveData = await resolveRes.json();
          if (resolveData.resolved_url) {
            finalUrl = resolveData.resolved_url;
            addStatus('Endpoint Resolved Successfully');
          }
        }
      }

      addStatus('Injecting Vision CoV Protocol...');
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RRIS-SECRET': APP_SECRET },
        body: JSON.stringify({ maps_url: finalUrl }),
      });
      const data = await res.json();
      setTaskId(data.task_id);
      addStatus('Vision Process Dispatched');
    } catch (err) {
      setIsLoading(false);
      toast.error('Connection Lost');
    }
  };

  return (
    <main className="min-h-screen">
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full" />
      </div>

      <div className={`transition-all duration-1000 flex flex-col items-center justify-center p-6 ${result ? 'pt-20 pb-10' : 'h-screen'}`}>
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-3xl"
        >
          {/* Logo & Header */}
          {!result && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-[10px] font-bold tracking-[0.3em] text-purple-400 uppercase">
                <Sparkles size={12} />
                AI-Powered Audit
              </div>
              <h1 className="text-7xl font-black tracking-tighter text-white">
                RR<span className="text-purple-500">IS</span>
              </h1>
              <p className="text-white/40 text-sm font-medium max-w-md mx-auto leading-relaxed">
                Advanced Refrigeration Intelligence using Gemini Vision
                & Chain-of-Verification technology.
              </p>
            </motion.div>
          )}

          {/* Search Box */}
          <form onSubmit={handleStartAudit} className="relative group">
            <div className={`absolute inset-0 bg-purple-600/20 blur-2xl rounded-full transition-opacity duration-500 ${mapsUrl ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative glass-card rounded-full p-2 flex items-center purple-glow-sm group-focus-within:purple-glow-lg transition-all border-white/10 group-focus-within:border-purple-500/50">
              <div className="pl-6 text-white/30 group-focus-within:text-purple-400 transition-colors">
                <Search size={24} />
              </div>
              <input
                type="text"
                placeholder="Secure Google Maps URL..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="flex-1 bg-transparent border-none px-6 py-4 text-lg font-medium focus:ring-0 text-white placeholder:text-white/20"
              />
              <button
                type="submit"
                disabled={isLoading || !mapsUrl}
                className="h-14 px-10 bg-gradient-to-tr from-purple-600 to-violet-500 text-white rounded-full font-bold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(139,92,246,0.5)] transition-all disabled:opacity-50 active:scale-95"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'Analyze'}
                <ArrowRight size={20} />
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && !result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-2xl"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="w-48 h-48 rounded-full border-t-2 border-purple-500 shadow-[0_0_50px_rgba(139,92,246,0.2)]"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-transparent">
                <div className="flex flex-col items-center">
                  <Cpu className="text-purple-500 animate-pulse" size={32} />
                  <span className="mt-4 text-[10px] font-black tracking-widest text-purple-500/50 uppercase">Active</span>
                </div>
              </div>
            </div>

            {/* Status Feed */}
            <div className="mt-16 w-full max-w-sm px-6">
              <div className="space-y-3">
                {statusFeed.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1 - (idx * 0.2), x: 0 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-purple-500 shadow-[0_0_8px_rgba(139,92,246,1)]' : 'bg-white/10'}`} />
                    <span className={`text-xs font-bold tracking-wide ${idx === 0 ? 'text-white' : 'text-white/30'}`}>
                      {msg}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results View */}
      <AnimatePresence>
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1200px] mx-auto px-6 pb-24"
          >
            <div className="glass-card rounded-[40px] p-10 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 purple-glow-sm">
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 rounded-3xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                  <Layers size={32} />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Audit Synchronized</h2>
                  <p className="text-white/40 text-sm font-medium tracking-tight truncate max-w-[300px]">
                    {result.store_maps_url}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center sm:items-start">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Store Format</span>
                  <span className="text-lg font-bold text-purple-400 capitalize">{result.outlet_type}</span>
                </div>
                <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center sm:items-start">
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Scan Depth</span>
                  <span className="text-lg font-bold text-purple-400">{result.total_images_scraped} Views</span>
                </div>
              </div>
            </div>

            <AuditDisplay
              imageUrl={result.store_maps_url} // This is just a placeholder or we need to pass detections
              detections={[]} // AuditDisplay will be updated to handle the new CoV result
              covResult={result}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* FAB: Sync to Google Sheets */}
      <AnimatePresence>
        {result && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              toast.promise(
                fetch(`${API_URL}/sync-sheets`, { method: 'POST', headers: { 'X-RRIS-SECRET': APP_SECRET } }),
                {
                  loading: 'Syncing Intelligence...',
                  success: 'Distributed to Cloud Nodes',
                  error: 'Sync Interrupted',
                }
              );
            }}
            className="fixed bottom-10 right-10 w-20 h-20 bg-purple-600 text-white rounded-[30px] shadow-2xl flex items-center justify-center group hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all z-50 border border-purple-400/30"
          >
            <Table size={32} />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}
