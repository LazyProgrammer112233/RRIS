import { NextRequest, NextResponse } from 'next/server';
import { extractPlaceId, getPlaceDetails, buildPhotoUrls } from '@/lib/googlePlaces';
import { detectBoundingBoxesInBatch } from '@/lib/geminiDetector';
import { cropImageRegion } from '@/lib/regionCropper';
import { classifyWithLocalClip } from '@/lib/clipClassifier';
import { computeConfidence, meetsThreshold } from '@/lib/confidenceEngine';
import { generateSummary, generateSingleImageSummary } from '@/lib/summaryBuilder';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        const { maps_url } = await req.json();
        const debug = process.env.DEBUG_DETECTION === "true";

        if (!maps_url) {
            return NextResponse.json({ error: 'maps_url is required' }, { status: 400 });
        }

        console.log(`[RRIS] Analyzing maps URL: ${maps_url}`);

        // 1. Extract Place ID
        const placeId = await extractPlaceId(maps_url);
        if (!placeId) {
            return NextResponse.json({ error: 'Could not extract place_id from URL' }, { status: 400 });
        }
        console.log(`[RRIS] Extracted Place ID: ${placeId}`);

        // Check if store already exists to avoid redundant analysis
        const { data: existingStore } = await supabaseAdmin
            .from('stores')
            .select('id, fridge_analysis')
            .eq('place_id', placeId)
            .single();

        if (existingStore && existingStore.fridge_analysis) {
            console.log(`[RRIS] Store already analyzed, returning id: ${existingStore.id}`);
            return NextResponse.json({ store_id: existingStore.id, message: 'Store already analyzed' }, { status: 200 });
        }

        // 2. Fetch Place Details
        const placeDetails = await getPlaceDetails(placeId);

        // 3. Insert or Update Store
        let storeId;
        if (!existingStore) {
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
                console.error("[RRIS] Store Insert Error:", storeError);
                throw storeError;
            }
            storeId = store.id;
        } else {
            storeId = existingStore.id;
        }

        // 4. Fetch Photo URLs (max 10 images)
        const photoUrls = buildPhotoUrls(placeDetails.photos, 10);
        console.log(`[RRIS] Found ${photoUrls.length} photos to analyze.`);

        if (photoUrls.length === 0) {
            const fridgeAnalysis = {
                contains_fridge: false,
                detection_method: "gemini_clip_hybrid_local",
                total_appliances: 0,
                appliance_counts: {},
                summary: "No photos available for this store.",
                images_analyzed: 0,
            };
            await supabaseAdmin.from('stores').update({ fridge_analysis: fridgeAnalysis }).eq('id', storeId);
            return NextResponse.json({ store_id: storeId, success: true }, { status: 200 });
        }

        // 5. Insert Image Records (clear old ones first)
        await supabaseAdmin.from('store_images').delete().eq('store_id', storeId);

        const imageInsertData = photoUrls.map((url: string, index: number) => ({
            store_id: storeId,
            image_url: url,
            image_order: index + 1,
        }));

        const { data: insertedImages, error: batchImgError } = await supabaseAdmin
            .from('store_images')
            .insert(imageInsertData)
            .select();

        if (batchImgError || !insertedImages) {
            console.error("[RRIS] Image Batch Insert Error:", batchImgError);
            throw batchImgError || new Error("No images returned from insert");
        }

        // 6. BATCH DETECTION: Gemini finds bounding boxes for ALL images
        console.log(`[RRIS] Starting batch Gemini bounding box analysis of ${photoUrls.length} images...`);
        const batchResults = await detectBoundingBoxesInBatch(photoUrls);

        // 7. Process crops and local CLIP classification
        const allImageDetections: { objects: { category: string; confidence: number }[] }[] = [];

        for (let i = 0; i < insertedImages.length; i++) {
            const imageRecord = insertedImages[i];
            const imageUrl = photoUrls[i];
            const detection = batchResults[i] || { appliances_detected: false, objects: [] };

            const finalImageObjects: { category: string; confidence: number }[] = [];

            if (detection.appliances_detected && detection.objects.length > 0) {
                for (const obj of detection.objects) {
                    if (!obj.bounding_box) continue;

                    try {
                        // Crop the image
                        const croppedBuffer = await cropImageRegion(imageUrl, obj.bounding_box);
                        if (!croppedBuffer) {
                            if (debug) console.log(`[DEBUG] Image ${i + 1}: Failed to crop region, skipping.`);
                            continue;
                        }

                        // Local CLIP classification
                        const clipResult = await classifyWithLocalClip(croppedBuffer);

                        // Compute final confidence
                        const finalConfidence = computeConfidence(obj.confidence, clipResult.score);

                        if (debug) {
                            console.log(`[DEBUG] Image ${i + 1} Obj: Gemini Conf: ${obj.confidence.toFixed(3)}, CLIP Score (${clipResult.label}): ${clipResult.score.toFixed(3)} -> Final: ${finalConfidence.toFixed(3)}`);
                        }

                        // Threshold filtering
                        if (meetsThreshold(finalConfidence)) {
                            finalImageObjects.push({
                                category: clipResult.label,
                                confidence: parseFloat(finalConfidence.toFixed(3)),
                            });
                        }
                    } catch (cropErr: any) {
                        console.error(`[RRIS] Error processing appliance in image ${i + 1}:`, cropErr.message);
                    }
                }
            }

            const imageSummary = generateSingleImageSummary(finalImageObjects);

            if (debug) {
                console.log(`[DEBUG] Image ${i + 1} final result: ${finalImageObjects.length} appliance(s) -> ${imageSummary}`);
            }

            // Store in image_analysis table
            await supabaseAdmin.from('image_analysis').insert({
                image_id: imageRecord.id,
                detected_objects: { objects: finalImageObjects },
                appliance_found: finalImageObjects.length > 0,
                analysis_summary: imageSummary,
            });

            allImageDetections.push({ objects: finalImageObjects });
        }

        // 8. Build aggregate summary
        const { summaryText, counts } = generateSummary(allImageDetections);
        const totalAppliances = Object.values(counts).reduce((sum, c) => sum + c, 0);

        const fridgeAnalysis = {
            contains_fridge: totalAppliances > 0,
            detection_method: "gemini_clip_hybrid_local",
            total_appliances: totalAppliances,
            appliance_counts: counts,
            summary: summaryText,
            images_analyzed: photoUrls.length,
        };

        const { error: updateError } = await supabaseAdmin
            .from('stores')
            .update({ fridge_analysis: fridgeAnalysis })
            .eq('id', storeId);

        if (updateError) {
            console.error("[RRIS] Update Store Error:", updateError);
            throw updateError;
        }

        console.log(`\n[RRIS] ✓ Analysis complete. ${totalAppliances} appliance(s) across ${photoUrls.length} images.`);

        return NextResponse.json({ store_id: storeId, success: true }, { status: 200 });

    } catch (error: any) {
        console.error('[RRIS] Error analyzing store:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
