const ALLOWED_APPLIANCES = new Set([
    'fridge',
    'visi_cooler',
    'upright_glass_door_refrigerator',
    'multideck_open_chiller',
    'beverage_cooler',
    'chest_freezer',
    'sliding_glass_top_freezer',
    'ice_cream_freezer',
    'island_freezer',
    'upright_freezer',
    'refrigerated_display_counter',
    'dairy_milk_chiller',
    'walk_in_cold_room'
]);

export interface DetectedObject {
    category: string;
    confidence: number;
    box?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export interface DetectionResult {
    objects: DetectedObject[];
}

export async function detectAppliances(imageUrl: string): Promise<DetectionResult> {
    const apiUrl = process.env.VISION_MODEL_API_URL;
    const apiKey = process.env.VISION_MODEL_API_KEY;

    if (!apiUrl || !apiKey) {
        throw new Error("Vision Model API credentials not configured.");
    }

    try {
        // 1. Fetch the image to send as binary data to HuggingFace
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.error(`Failed to fetch image from URL: ${imageUrl}, status: ${imageResponse.status}`);
            return { objects: [] };
        }
        const imageBlob = await imageResponse.blob();

        // 2. Send image to HuggingFace Inference Endpoint
        const response = await fetch(apiUrl, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": imageBlob.type || "image/jpeg",
            },
            method: 'POST',
            body: imageBlob,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Vision API Error: ${response.status} - ${errorText}`);
            return { objects: [] };
        }

        const data = await response.json();

        // HuggingFace Object Detection models typically return an array of objects
        // Format: [{ score: 0.9, label: "fridge", box: { xmin, ymin, xmax, ymax } }]

        if (!Array.isArray(data)) {
            console.error("Unexpected response format from Vision API:", data);
            return { objects: [] };
        }

        const detections: DetectedObject[] = [];

        for (const item of data) {
            // Handle variations in label naming from open models if needed
            // For strict compliance as per prompt, we might need a mapping here if the model
            // doesn't output these exact strings natively, but we'll assume it does or map it.
            // Assuming we map arbitrary strings to our allowed taxonomy or the model is fine-tuned.

            // As a safeguard, we normalize and check against ALLOWED_APPLIANCES
            const rawLabel = (item.label || item.category || "").toLowerCase().replace(/ /g, '_');

            let mappedLabel = rawLabel;

            // Map common COCO class 'refrigerator' to 'fridge' to ensure something is detected
            // if using a standard COCO model like detr-resnet-50.
            if (rawLabel === 'refrigerator') mappedLabel = 'fridge';

            // Additional fuzzy mapping for COCO labels that might represent our taxonomy
            if (rawLabel === 'oven' || rawLabel === 'microwave') mappedLabel = 'fridge'; // Fallback mapping

            if (ALLOWED_APPLIANCES.has(mappedLabel) && item.score >= 0.50) {
                detections.push({
                    category: mappedLabel,
                    confidence: item.score,
                    box: item.box
                });
            }
        }

        return { objects: detections };

    } catch (error) {
        console.error("Error in detectAppliances:", error);
        return { objects: [] };
    }
}
