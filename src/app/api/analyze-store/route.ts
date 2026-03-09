import { NextRequest, NextResponse } from 'next/server';
import { extractPlaceId, getPlaceDetails, buildPhotoUrls } from '@/lib/googlePlaces';
import { detectAppliances } from '@/lib/applianceDetector';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSingleImageSummary } from '@/lib/summaryBuilder';

export async function POST(req: NextRequest) {
    try {
        const { maps_url } = await req.json();

        if (!maps_url) {
            return NextResponse.json({ error: 'maps_url is required' }, { status: 400 });
        }

        console.log(`Analyzing maps URL: ${maps_url}`);

        // 1. Extract Place ID
        const placeId = await extractPlaceId(maps_url);
        if (!placeId) {
            return NextResponse.json({ error: 'Could not extract place_id from URL' }, { status: 400 });
        }
        console.log(`Extracted Place ID: ${placeId}`);

        // Check if store already exists to avoid redundant analysis
        const { data: existingStore } = await supabaseAdmin
            .from('stores')
            .select('id')
            .eq('place_id', placeId)
            .single();

        if (existingStore) {
            console.log(`Store already exists, returning id: ${existingStore.id}`);
            return NextResponse.json({ store_id: existingStore.id, message: 'Store already analyzed' }, { status: 200 });
        }

        // 2. Fetch Place Details
        const placeDetails = await getPlaceDetails(placeId);

        // 3. Insert Store
        const { data: store, error: storeError } = await supabaseAdmin
            .from('stores')
            .insert({
                store_name: placeDetails.name,
                address: placeDetails.formatted_address,
                maps_url: maps_url,
                place_id: placeId,
            })
            .select()
            .single();

        if (storeError) {
            console.error("Store Insert Error:", storeError);
            throw storeError;
        }

        const storeId = store.id;

        // 4. Fetch Photo URLs
        const photoUrls = buildPhotoUrls(placeDetails.photos, 15);
        console.log(`Found ${photoUrls.length} photos to analyze.`);

        // 5. Sequential Image Processing
        for (let i = 0; i < photoUrls.length; i++) {
            const imageUrl = photoUrls[i];
            console.log(`Processing image ${i + 1}/${photoUrls.length}`);

            // 5a. Insert Image Record
            const { data: image, error: imgError } = await supabaseAdmin
                .from('store_images')
                .insert({
                    store_id: storeId,
                    image_url: imageUrl,
                    image_order: i + 1,
                })
                .select()
                .single();

            if (imgError) {
                console.error("Image Insert Error:", imgError);
                continue; // Skip processing this image but continue others
            }

            // 5b. Send to Vision Detection API
            const detectionResult = await detectAppliances(imageUrl);

            const applianceFound = detectionResult.objects.length > 0;
            const analysisSummary = generateSingleImageSummary(detectionResult.objects);

            // 5c. Store Analysis Result
            await supabaseAdmin
                .from('image_analysis')
                .insert({
                    image_id: image.id,
                    detected_objects: detectionResult.objects,
                    appliance_found: applianceFound,
                    analysis_summary: analysisSummary
                });

            // Optional: Add a small delay between requests to avoid rate limits? (Skipped for now, but sequential naturally slows it down)
        }

        return NextResponse.json({ store_id: storeId, success: true }, { status: 200 });

    } catch (error: any) {
        console.error('Error analyzing store:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
