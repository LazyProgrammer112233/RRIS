"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, ChevronRight, BarChart3 } from 'lucide-react';

interface Detection {
    source_image_url: string;
    localization: {
        asset_type: string;
        box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
        confidence: number;
    };
    audit: {
        asset_classification: string;
        brand_logo: string;
        purity: 'Pure' | 'Mixed';
        stock_level: string;
        confirmed_via_ocr: boolean;
        reasoning: string;
    };
}

interface AuditDisplayProps {
    imageUrl: string;
    detections: Detection[];
}

export default function AuditDisplay({ imageUrl, detections }: AuditDisplayProps) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    return (
        <div className="flex flex-col lg:flex-row w-full h-full gap-8 animate-in fade-in duration-700">

            {/* Left Column: Interactive Image */}
            <div className="flex-1 relative group bg-black/20 rounded-3xl overflow-hidden border border-white/5 shadow-2xl h-fit">
                <img
                    src={imageUrl}
                    alt="Retail Audit"
                    className="w-full h-auto object-contain transition-transform duration-1000 group-hover:scale-105"
                />

                {/* SVG Bounding Box Overlay */}
                <div className="absolute inset-0">
                    {detections.map((det, idx) => {
                        const [ymin, xmin, ymax, xmax] = det.localization.box_2d;
                        const isMixed = det.audit.purity === 'Mixed';

                        const top = (ymin / 10).toFixed(2);
                        const left = (xmin / 10).toFixed(2);
                        const height = ((ymax - ymin) / 10).toFixed(2);
                        const width = ((xmax - xmin) / 10).toFixed(2);

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{
                                    opacity: 1,
                                    scale: 1,
                                    boxShadow: selectedIdx === idx
                                        ? '0 0 25px rgba(255,255,255,0.4)'
                                        : '0 0 10px rgba(0,0,0,0.3)'
                                }}
                                className={`absolute cursor-pointer border-2 transition-colors ${isMixed
                                        ? 'border-red-500'
                                        : 'border-cyan-400'
                                    } rounded-sm`}
                                style={{
                                    top: `${top}%`,
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                    zIndex: selectedIdx === idx ? 40 : 10
                                }}
                                onClick={() => setSelectedIdx(idx)}
                            >
                                {/* Red Pulse Animation for Infringement */}
                                {isMixed && (
                                    <motion.div
                                        animate={{
                                            opacity: [0.1, 0.4, 0.1],
                                            scale: [1, 1.05, 1]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                        className="absolute inset-0 bg-red-500/30 rounded-sm pointer-events-none"
                                    />
                                )}

                                {/* mini-label */}
                                <div className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded-t text-[8px] font-bold uppercase tracking-widest ${isMixed ? 'bg-red-500' : 'bg-cyan-500'
                                    } text-white whitespace-nowrap`}>
                                    {det.audit.brand_logo}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Right Column: Asset Details List */}
            <div className="w-full lg:w-[400px] flex flex-col gap-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-2">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white/40 tracking-widest uppercase">Detected Assets</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                        <BarChart3 size={12} className="text-cyan-400" />
                        <span className="text-[10px] font-bold text-white/60">{detections.length} Total</span>
                    </div>
                </div>

                <AnimatePresence mode="popLayout">
                    {detections.map((det, idx) => {
                        const isMixed = det.audit.purity === 'Mixed';
                        const isSelected = selectedIdx === idx;

                        return (
                            <motion.div
                                key={idx}
                                layout
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                whileHover={{ scale: 1.02, x: 4 }}
                                onClick={() => setSelectedIdx(idx)}
                                className={`group p-5 rounded-2xl cursor-pointer border transition-all duration-300 ${isSelected
                                        ? 'bg-white/10 border-white/20 shadow-xl'
                                        : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                                    } ${isMixed ? 'ring-1 ring-red-500/20' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">
                                            {det.localization.asset_type}
                                        </span>
                                        <h4 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                                            {det.audit.brand_logo}
                                        </h4>
                                    </div>
                                    <div className={`p-2 rounded-xl ${isMixed ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        {isMixed ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                                    </div>
                                </div>

                                {isSelected && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="mt-4 pt-4 border-t border-white/10 space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-white/20 uppercase font-black">Stock Level</span>
                                                <span className="text-xs text-white/80">{det.audit.stock_level}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 text-right">
                                                <span className="text-[9px] text-white/20 uppercase font-black">Purity</span>
                                                <span className={`text-xs ${isMixed ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                                                    {det.audit.purity}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 p-3 bg-black/20 rounded-xl border border-white/5 italic text-[11px] text-white/60 leading-relaxed shadow-inner">
                                            <div className="flex items-center gap-2 not-italic font-bold text-white/40 mb-1">
                                                <Info size={12} className="text-cyan-400/50" />
                                                AI REASONING
                                            </div>
                                            "{det.audit.reasoning}"
                                            <div className="mt-2 flex items-center justify-end gap-1 text-[9px] not-italic text-emerald-400/60 font-medium">
                                                <ChevronRight size={10} /> Verified via Logo OCR
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
