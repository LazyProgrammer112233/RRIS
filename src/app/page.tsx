"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ArrowRight, Table, CheckCircle, Info, Database, Sparkles, Cpu, Layers, Download, Zap } from 'lucide-react';
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
            const errorMsg = data.result?.error || 'Intelligence Retrieval Failed';
            toast.error(errorMsg);
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
              className="text-center mb-8 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-[9px] font-black tracking-[0.3em] text-purple-400/80 uppercase">
                <Sparkles size={10} />
                AI-Powered Audit
              </div>
              <h1 className="text-6xl font-black tracking-tighter text-white">
                RR<span className="text-purple-500">IS</span>
              </h1>
              <p className="text-white/30 text-xs font-medium max-w-sm mx-auto leading-relaxed">
                Advanced Refrigeration Intelligence using Gemini Vision
                & Chain-of-Verification technology.
              </p>
            </motion.div>
          )}

          {/* Search Box */}
          <form onSubmit={handleStartAudit} className="relative group max-w-2xl mx-auto">
            <div className={`absolute inset-0 bg-purple-600/10 blur-3xl rounded-full transition-opacity duration-500 ${mapsUrl ? 'opacity-100' : 'opacity-0'}`} />
            <div className="relative glass-card rounded-2xl p-1.5 flex items-center purple-glow-sm group-focus-within:purple-glow-lg transition-all border-white/5 group-focus-within:border-purple-500/30 overflow-hidden">
              <div className="pl-5 text-white/20 group-focus-within:text-purple-400/60 transition-colors">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Paste Google Maps URL..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="search-input flex-1 bg-transparent border-none px-4 py-3 text-base font-medium text-white placeholder:text-white/10"
              />
              <button
                type="submit"
                disabled={isLoading || !mapsUrl}
                className="h-11 px-8 bg-gradient-to-tr from-purple-600 to-violet-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all disabled:opacity-30 active:scale-95"
              >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <ArrowRight size={18} />}
                <span className="hidden sm:inline">Analyze</span>
              </button>
            </div>
          </form>

          {!result && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="glass-card rounded-[24px] p-8 border-white/5 relative overflow-hidden group hover:purple-glow-sm transition-all duration-500">
                <div className="absolute top-0 right-0 p-6 text-purple-500/10 group-hover:text-purple-500/20 transition-colors">
                  <Database size={80} />
                </div>
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-6 border border-purple-500/10">
                    <Zap size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Industry Bulk Analysis</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-8">
                    Analyze thousands of outlets using CSV datasets. This runs locally on your computer for maximum privacy and processing speed.
                  </p>
                  <a 
                    href="/rris_bulk_worker.zip" 
                    download
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white hover:bg-white/10 hover:border-purple-500/30 transition-all active:scale-95"
                  >
                    <Download size={16} />
                    Install Offline Bulk Worker
                  </a>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-8 border-white/5 relative overflow-hidden group border-dashed border-white/10 flex flex-col justify-center items-center text-center opacity-50">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 mb-4">
                  <Layers size={20} />
                </div>
                <h3 className="text-lg font-bold text-white/40">Enterprise Integrations</h3>
                <p className="text-white/20 text-xs mt-1">Coming Q4 2026</p>
              </div>
            </motion.div>
          )}
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
            <div className="glass-card rounded-[32px] p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 purple-glow-sm border-white/5">
              <div className="flex items-center gap-5 text-center md:text-left">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/10">
                  <Layers size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">Audit Synchronized</h2>
                  <p className="text-white/30 text-[11px] font-medium tracking-tight truncate max-w-[250px] mt-0.5">
                    {result.store_maps_url}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="px-4 py-2 bg-white/[0.01] rounded-xl border border-white/5 flex flex-col items-center sm:items-start min-w-[100px]">
                  <span className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none mb-1">Store Format</span>
                  <span className="text-sm font-bold text-purple-400/80 capitalize">{result.outlet_type}</span>
                </div>
                <div className="px-4 py-2 bg-white/[0.01] rounded-xl border border-white/5 flex flex-col items-center sm:items-start min-w-[100px]">
                  <span className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none mb-1">Scan Depth</span>
                  <span className="text-sm font-bold text-purple-400/80">{result.total_images_scraped} Views</span>
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
