import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSummary } from '@/lib/summaryBuilder';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const storeId = (await params).id;

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        // 1. Fetch Store Metadata
        const { data: store, error: storeError } = await supabaseAdmin
            .from('stores')
            .select('*')
            .eq('id', storeId)
            .single();

        if (storeError || !store) {
            return NextResponse.json({ error: 'Store not found' }, { status: 404 });
        }

        // 2. Fetch Images and Analysis
        const { data: images, error: imagesError } = await supabaseAdmin
            .from('store_images')
            .select(`
        *,
        image_analysis (*)
      `)
            .eq('store_id', storeId)
            .order('image_order', { ascending: true });

        if (imagesError) {
            console.error("Error fetching images:", imagesError);
            return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
        }

        // 3. Transform and Aggregate Data
        const formattedImages = images.map(img => {
            const analysis = img.image_analysis && img.image_analysis.length > 0 ? img.image_analysis[0] : null;
            return {
                id: img.id,
                url: img.image_url,
                order: img.image_order,
                analysis: analysis ? {
                    detected_objects: analysis.detected_objects,
                    appliance_found: analysis.appliance_found,
                    summary: analysis.analysis_summary
                } : null
            };
        });

        // 4. Generate Final Category Summary
        const detectionsToSummarize = formattedImages
            .filter(img => img.analysis && img.analysis.detected_objects)
            .map(img => ({ objects: img.analysis!.detected_objects }));

        const { summaryText, counts } = generateSummary(detectionsToSummarize);

        // 5. Build Response payload
        const responsePayload = {
            store: {
                id: store.id,
                name: store.store_name,
                address: store.address,
                mapsUrl: store.maps_url,
                imagesAnalyzed: formattedImages.length
            },
            images: formattedImages,
            overallSummary: {
                text: summaryText,
                counts: counts
            }
        };

        return NextResponse.json(responsePayload, { status: 200 });

    } catch (error: any) {
        console.error('Error fetching store results:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
