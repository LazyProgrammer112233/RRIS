import { pipeline, env, RawImage } from '@xenova/transformers';
import { Jimp } from 'jimp';

// Disallow loading local models from the file system, force fetching from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = false;

// Use HuggingFace mirror because the primary domain is blocked by the network
env.remoteHost = 'https://hf-mirror.com';

// We use the Xenova port of clip-vit-base-patch32
const modelId = 'Xenova/clip-vit-base-patch32';

let classifier: any = null;

export async function getClipClassifier() {
    if (!classifier) {
        console.log("[CLIP] Loading model from Hugging Face Hub (this may take a few seconds on first run)...");
        // zero-shot-image-classification pipeline
        classifier = await pipeline('zero-shot-image-classification', modelId);
    }
    return classifier;
}

const CANDIDATE_LABELS = [
    "fridge",
    "visi_cooler",
    "upright_glass_door_refrigerator",
    "multideck_open_chiller",
    "beverage_cooler",
    "chest_freezer",
    "sliding_glass_top_freezer",
    "ice_cream_freezer",
    "island_freezer",
    "upright_freezer",
    "refrigerated_display_counter",
    "dairy_milk_chiller",
    "walk_in_cold_room"
];

// Expanded natural language labels for better CLIP matching
const NATURAL_LABELS = [
    "a photo of a standard refrigerator",
    "a photo of a visi cooler or glass-door upright Coca-Cola cooler",
    "a photo of an upright glass door refrigerator",
    "a photo of a multideck open chiller with shelves in a supermarket",
    "a photo of a beverage cooler or small fridge",
    "a photo of a chest freezer that opens from the top",
    "a photo of a sliding glass top freezer",
    "a photo of an ice cream freezer",
    "a photo of an island freezer in the middle of a store",
    "a photo of an upright freezer without glass doors",
    "a photo of a refrigerated display counter or deli case",
    "a photo of a dairy or milk chiller",
    "a photo of a walk-in cold room or massive cooler"
];

const LABEL_MAP: Record<string, string> = {
    "a photo of a standard refrigerator": "fridge",
    "a photo of a visi cooler or glass-door upright Coca-Cola cooler": "visi_cooler",
    "a photo of an upright glass door refrigerator": "upright_glass_door_refrigerator",
    "a photo of a multideck open chiller with shelves in a supermarket": "multideck_open_chiller",
    "a photo of a beverage cooler or small fridge": "beverage_cooler",
    "a photo of a chest freezer that opens from the top": "chest_freezer",
    "a photo of a sliding glass top freezer": "sliding_glass_top_freezer",
    "a photo of an ice cream freezer": "ice_cream_freezer",
    "a photo of an island freezer in the middle of a store": "island_freezer",
    "a photo of an upright freezer without glass doors": "upright_freezer",
    "a photo of a refrigerated display counter or deli case": "refrigerated_display_counter",
    "a photo of a dairy or milk chiller": "dairy_milk_chiller",
    "a photo of a walk-in cold room or massive cooler": "walk_in_cold_room"
};

/**
 * Perform local zero-shot classification on a cropped image buffer.
 */
export async function classifyWithLocalClip(imageBuffer: Buffer): Promise<{ label: string, score: number }> {
    try {
        const cls = await getClipClassifier();

        // Use Jimp (Pure JS) to decode the Buffer safely without VIPS crashes
        const image = await Jimp.read(imageBuffer);

        // Feed direct pixel data into Xenova RawImage (Jimp uses RGBA - 4 channels)
        const rawImage = new RawImage(
            new Uint8Array(image.bitmap.data),
            image.bitmap.width,
            image.bitmap.height,
            4
        );

        // Predict
        const results = await cls(rawImage, NATURAL_LABELS);

        // results is an array sorted by highest score: [{ score, label }, ...]
        if (!results || results.length === 0) {
            return { label: "unknown", score: 0 };
        }

        const topResult = results[0];
        const canonicalLabel = LABEL_MAP[topResult.label] || "fridge";

        return {
            label: canonicalLabel,
            score: topResult.score
        };
    } catch (err: any) {
        console.error("[CLIP] Error during local classification:", err.message);
        throw err;
    }
}
