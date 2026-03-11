"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, Image as ImageIcon, Info, Target, Cpu, CheckCircle2, AlertCircle } from 'lucide-react';

interface CoVResult {
    contains_fridge: boolean;
    detection_method: 'store_type_inference' | 'visual_detection';
    outlet_type: string;
    reason: string;
    evidence_image: string | null;
    confidence: 'high' | 'medium' | 'low';
    verification_notes: string;
}

interface AuditDisplayProps {
    covResult: CoVResult;
    imageUrl?: string; // Not strictly used anymore since we have evidence_image
    detections?: any[]; // Legacy
}

export default function AuditDisplay({ covResult }: AuditDisplayProps) {
    const isInference = covResult.detection_method === 'store_type_inference';
    const hasFridge = covResult.contains_fridge;

    return (
        <div className="space-y-12">
            {/* Main Result Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-[48px] p-12 purple-glow-lg border-white/10"
            >
                <div className="flex flex-col lg:flex-row gap-16">
                    {/* Left Side: Status & reasoning */}
                    <div className="flex-1 space-y-10">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                {hasFridge ? (
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <ShieldCheck size={28} />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
                                        <AlertCircle size={28} />
                                    </div>
                                )}
                                <h3 className="text-4xl font-black text-white">
                                    {hasFridge ? 'Fridge Detected' : 'No Fridge Identified'}
                                </h3>
                            </div>
                            <p className="text-xl text-white/60 font-medium leading-relaxed italic">
                                "{covResult.reason}"
                            </p>
                        </div>

                        {/* Intelligence Metrics */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest">
                                    <Target size={14} className="text-purple-500" />
                                    Confidence
                                </div>
                                <div className="text-2xl font-black text-white capitalize">{covResult.confidence}</div>
                            </div>
                            <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 space-y-1">
                                <div className="flex items-center gap-2 text-white/30 text-[10px] font-black uppercase tracking-widest">
                                    <Cpu size={14} className="text-purple-500" />
                                    Methodology
                                </div>
                                <div className="text-2xl font-black text-white capitalize truncate">
                                    {covResult.detection_method.replace(/_/g, ' ')}
                                </div>
                            </div>
                        </div>

                        {/* Verification Notes */}
                        <div className="glass-card bg-purple-500/5 rounded-[32px] p-8 border-purple-500/20">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                                    <CheckCircle2 size={16} />
                                </div>
                                <span className="text-xs font-black tracking-[0.2em] text-purple-400 uppercase">Verification Protocol Notes</span>
                            </div>
                            <p className="text-sm text-purple-200/50 leading-relaxed font-medium">
                                {covResult.verification_notes}
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Evidence or Badge */}
                    <div className="w-full lg:w-[450px]">
                        {isInference ? (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center relative group">
                                <div className="absolute inset-0 bg-purple-500/10 blur-[100px] group-hover:bg-purple-500/20 transition-all duration-1000" />
                                <motion.div
                                    animate={{
                                        y: [0, -10, 0],
                                        rotate: [0, 2, 0]
                                    }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="relative z-10 p-12 glass-card rounded-[40px] border-purple-500/30 flex flex-col items-center text-center space-y-6"
                                >
                                    <div className="w-24 h-24 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                                        <ShieldCheck size={48} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-white">Trust Inference</h4>
                                        <p className="text-[10px] uppercase font-black tracking-widest text-purple-500/50 mt-1">Verified Format</p>
                                    </div>
                                    <p className="text-xs text-white/40 leading-relaxed">
                                        This outlet format is commercially verified to contain refrigeration systems as part of its core infrastructure.
                                    </p>
                                </motion.div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-4">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Visual Evidence</span>
                                    {covResult.evidence_image && (
                                        <span className="text-[10px] font-bold text-purple-400 px-3 py-1 bg-purple-500/10 rounded-full border border-purple-500/20">
                                            {covResult.evidence_image.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="aspect-[4/5] rounded-[40px] overflow-hidden glass-card border-white/10 group relative">
                                    {covResult.contains_fridge ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-4 rounded-3xl bg-white/10 border border-white/20 flex flex-col items-center gap-2">
                                                <ImageIcon size={24} className="text-purple-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Primary Detection Point</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
                                            <div className="flex flex-col items-center gap-3 opacity-40">
                                                <ImageIcon size={48} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">No Extraction Required</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="w-full h-full bg-gradient-to-br from-purple-500/10 to-violet-500/10 flex items-center justify-center">
                                        {/* Since we don't have the actual cropped evidence image URL directly, 
                                           we show a placeholder that looks like a scanner */}
                                        <div className="relative w-full h-full">
                                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                <Search size={120} className="text-white" />
                                            </div>
                                            <motion.div
                                                animate={{ top: ['0%', '100%', '0%'] }}
                                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                className="absolute left-0 right-0 h-0.5 bg-purple-500 shadow-[0_0_15px_rgba(139,92,246,1)] z-20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Technical Detail Badge */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-4 px-6 py-3 rounded-2xl glass-card border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Engine Status:</span>
                        <span className="text-[10px] font-bold text-emerald-400">OPTIMIZED</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-purple-400 transition-colors cursor-help">
                        Chain-of-Verification Protocol v2.5
                    </span>
                </div>
            </div>
        </div>
    );
}
