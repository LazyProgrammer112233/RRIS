'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Store, MapPin, Image as ImageIcon, ArrowLeft, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface StoreData {
    id: string;
    name: string;
    address: string;
    mapsUrl: string;
    imagesAnalyzed: number;
}

interface AnalysisData {
    detected_objects: { category: string; confidence: number }[];
    appliance_found: boolean;
    summary: string;
}

interface ImageResult {
    id: string;
    url: string;
    order: number;
    analysis: AnalysisData | null;
}

export default function Results() {
    const params = useParams();
    const router = useRouter();
    const [storeData, setStoreData] = useState<StoreData | null>(null);
    const [images, setImages] = useState<ImageResult[]>([]);
    const [summary, setSummary] = useState<{ text: string; counts: Record<string, number> } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await fetch(`/api/store/${params.id}`);
                const data = await res.json();

                if (!res.ok) throw new Error(data.error || 'Failed to fetch results');

                setStoreData(data.store);
                setImages(data.images);
                setSummary(data.overallSummary);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        if (params.id) fetchResults();
    }, [params.id]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500">Loading analysis results...</p>
            </div>
        );
    }

    if (error || !storeData) {
        return (
            <div className="max-w-3xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-4 animate-in fade-in duration-300">
                <AlertCircle className="text-red-500 mt-1 flex-shrink-0" />
                <div>
                    <h3 className="text-lg font-medium text-red-800">Error loading results</h3>
                    <p className="text-red-700 mt-2">{error || 'Store not found'}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 text-sm text-red-600 hover:text-red-800 font-medium underline"
                    >
                        Go back to search
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header Controls */}
            <button
                onClick={() => router.push('/')}
                className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Analyze Another Store
            </button>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Store Info */}
                <div className="col-span-1 md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Store className="w-32 h-32" />
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="bg-blue-50 p-3 rounded-xl flex-shrink-0">
                            <Store className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{storeData.name}</h2>
                            <div className="mt-2 flex items-start text-gray-500">
                                <MapPin className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm">{storeData.address}</p>
                            </div>
                            <div className="mt-4 flex items-center text-sm font-medium text-blue-600 bg-blue-50 w-fit px-3 py-1 rounded-full border border-blue-100">
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {storeData.imagesAnalyzed} Images Analyzed
                            </div>
                        </div>
                    </div>
                </div>

                {/* Global Summary */}
                <div className="col-span-1 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4 border-b border-blue-400/30 pb-2">Appliance Summary</h3>
                    {summary && Object.keys(summary.counts).length > 0 ? (
                        <div className="space-y-3">
                            {Object.entries(summary.counts).map(([category, count]) => {
                                const formattedName = category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                return (
                                    <div key={category} className="flex justify-between items-center text-sm font-medium">
                                        <span className="text-blue-100">{formattedName}</span>
                                        <span className="bg-white/20 px-2.5 py-0.5 rounded-full">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-blue-100 italic">No refrigeration appliances found in any images.</p>
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100" />

            {/* Image Grid */}
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <ImageIcon className="w-5 h-5 mr-2 text-gray-400" />
                    Image Results
                </h3>

                {images.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                        <p className="text-gray-500">No images available for this store.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {images.map((img) => (
                            <div key={img.id} className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">

                                {/* Image Container */}
                                <div className="relative aspect-[4/3] bg-gray-100 w-full overflow-hidden">
                                    {/* Fallback pattern if image fails to load, or just plain grey */}
                                    <img
                                        src={img.url}
                                        alt={`Store Image ${img.order}`}
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />

                                    {/* Overlay Badge */}
                                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium border border-white/10">
                                        Image {img.order}
                                    </div>
                                </div>

                                {/* Analysis Data */}
                                <div className="p-5">
                                    <div className="mb-3">
                                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Analysis Result</h4>
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                            {img.analysis?.summary || 'Pending analysis...'}
                                        </p>
                                    </div>

                                    {img.analysis?.appliance_found && (
                                        <div className="mt-4 pt-4 border-t border-gray-50">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detections</h4>
                                            <div className="space-y-2">
                                                {img.analysis.detected_objects.map((obj, i) => {
                                                    const confPercent = Math.round(obj.confidence * 100);
                                                    const formattedName = obj.category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

                                                    return (
                                                        <div key={i} className="flex justify-between items-center text-sm">
                                                            <span className="font-medium text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                                                                {formattedName}
                                                            </span>
                                                            <span className={`font-medium ${confPercent >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                                                                {confPercent}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
