'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';

export default function Home() {
  const [mapsUrl, setMapsUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsUrl.trim() || !mapsUrl.includes('map')) {
      toast.error('Please enter a valid Google Maps URL');
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading('Analyzing store location and fetching images...');

    try {
      const response = await fetch('/api/analyze-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maps_url: mapsUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze store');
      }

      toast.success('Analysis complete!', { id: loadingToast });
      router.push(`/results/${data.store_id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'An error occurred during analysis', { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-16 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="px-8 py-10">
        <form onSubmit={handleAnalyze} className="space-y-6">
          <div>
            <label htmlFor="mapsUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Google Maps URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="url"
                name="mapsUrl"
                id="mapsUrl"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-colors"
                placeholder="https://maps.google.com/?cid=..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Paste the full Google Maps listing URL containing the place location.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !mapsUrl}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${(isLoading || !mapsUrl) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                Analyzing Store...
              </>
            ) : (
              'Analyze Store'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
