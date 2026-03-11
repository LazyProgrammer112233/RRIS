"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ArrowRight, Table, CheckCircle, Info, Database } from 'lucide-react';
import AuditDisplay from '@/components/AuditDisplay';
import toast, { Toaster } from 'react-hot-toast';

export default function RRISDashboard() {
  const [mapsUrl, setMapsUrl] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get API URL and Secret from env
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860';
  const APP_SECRET = process.env.NEXT_PUBLIC_APP_SECRET || '';

  // Poll for status if we have a taskId
  useEffect(() => {
    let interval: any;
    if (taskId && (status === 'PENDING' || status === 'RUNNING')) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/status/${taskId}`, {
            headers: { 'X-RRIS-SECRET': APP_SECRET },
          });
          const data = await res.json();
          setStatus(data.status);
          if (data.status === 'COMPLETED') {
            setResult(data.result);
            setIsLoading(false);
            toast.success('Audit Complete!');
          } else if (data.status === 'FAILED') {
            setIsLoading(false);
            toast.error('Audit Failed.');
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

    try {
      // 1. Resolve short URL locally via Vercel Edge Function first
      // This bypasses Hugging Face IP blocks for goo.gl links
      let finalUrl = mapsUrl;
      if (mapsUrl.includes("maps.app.goo.gl") || mapsUrl.includes("goo.gl")) {
        try {
          const resolveRes = await fetch('/api/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maps_url: mapsUrl })
          });
          if (resolveRes.ok) {
            const resolveData = await resolveRes.json();
            if (resolveData.resolved_url) {
              finalUrl = resolveData.resolved_url;
              console.log("Resolved short URL to:", finalUrl);
            }
          }
        } catch (resolveErr) {
          console.error("Short URL resolution failed:", resolveErr);
        }
      }

      // 2. Send the canonical resolved URL to the HF Backend
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-RRIS-SECRET': APP_SECRET },
        body: JSON.stringify({ maps_url: finalUrl }),
      });
      const data = await res.json();
      setTaskId(data.task_id);
      toast.success('Audit Task Started');
    } catch (err) {
      setIsLoading(false);
      toast.error('Failed to connect to backend.');
    }
  };

  const handleSyncToSheets = async () => {
    toast.promise(
      fetch(`${API_URL}/sync-sheets`, { method: 'POST', headers: { 'X-RRIS-SECRET': APP_SECRET } }),
      {
        loading: 'Syncing to Google Sheets...',
        success: 'Successfully Synced!',
        error: 'Sync Failed.',
      }
    );
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white selection:bg-cyan-500/30">
      <Toaster position="top-right" />

      {/* Search Header */}
      <div className={`transition-all duration-1000 flex flex-col items-center justify-center p-8 ${result ? 'pt-12 pb-8' : 'h-screen'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl text-center"
        >
          {!result && (
            <div className="mb-10 space-y-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-3xl mx-auto shadow-2xl shadow-cyan-500/20 flex items-center justify-center mb-6"
              >
                <Database className="text-white" size={32} />
              </motion.div>
              <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                RRIS ENGINE
              </h1>
              <p className="text-white/40 text-sm tracking-widest uppercase font-bold">
                Retail Refrigeration Intelligence System
              </p>
            </div>
          )}

          <form onSubmit={handleStartAudit} className="relative group">
            <input
              type="text"
              placeholder="Paste Google Maps URL..."
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              className="w-full h-20 bg-white/[0.03] border border-white/10 rounded-full px-10 pr-32 text-xl font-medium focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.05] transition-all shadow-2xl group-hover:border-white/20"
            />
            <button
              type="submit"
              disabled={isLoading || !mapsUrl}
              className="absolute right-3 top-3 bottom-3 px-8 bg-white text-black rounded-full font-bold flex items-center gap-2 hover:bg-cyan-400 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'Audit'}
              <ArrowRight size={20} />
            </button>
          </form>
        </motion.div>
      </div>

      {/* Processing State */}
      <AnimatePresence>
        {isLoading && !result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-32 h-32 rounded-full border-t-2 border-r-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="animate-spin text-cyan-400" size={40} />
              </div>
            </div>
            <p className="mt-10 text-lg font-black tracking-[0.2em] text-white/50 animate-pulse">
              {status || 'PROCESSING'}...
            </p>
            <p className="mt-4 text-[10px] text-white/20 uppercase font-black">
              Gemini Vision • Playwright Stealth • Logo OCR
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results View */}
      <AnimatePresence>
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1400px] mx-auto px-6 pb-24"
          >
            <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Audit Generated</h2>
                <p className="text-white/40 text-sm">{result.store_maps_url}</p>
              </div>
            </div>

            {result.audit_data.map((photo: any, idx: number) => (
              <div key={idx} className="mb-16">
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest text-white/60">
                    Viewpoint {idx + 1}
                  </span>
                  <hr className="flex-1 border-white/5" />
                </div>
                <AuditDisplay
                  imageUrl={photo.image_url}
                  detections={photo.detections}
                />
              </div>
            ))}
          </motion.section>
        )}
      </AnimatePresence>

      {/* FAB: Sync to Google Sheets */}
      <AnimatePresence>
        {result && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSyncToSheets}
            className="fixed bottom-10 right-10 w-20 h-20 bg-emerald-500 text-black rounded-full shadow-2xl flex items-center justify-center group hover:bg-cyan-400 transition-colors z-[100]"
          >
            <Table size={32} />
            <div className="absolute right-full mr-4 bg-black/80 px-4 py-2 rounded-xl text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 backdrop-blur-sm pointer-events-none">
              Sync to Google Sheets
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  );
}
