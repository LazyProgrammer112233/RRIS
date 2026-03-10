import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini Vision Bounding Box Detection module.
 *
 * ARCHITECTURE: Secures bounding boxes in a *batched* call to Gemini to avoid
 * rate limits while still generating precise crops for the downstream local CLIP model.
 */

const DETECTION_PROMPT = `You are a retail refrigeration specialist. You will be shown multiple images from a retail store. Analyze EACH image individually and detect any refrigeration appliances visible.

For EACH refrigeration appliance you detect, provide a bounding box and a brief description.

Rules:
- Analyze EVERY image. For each image, report what you find.
- Only detect real, physical refrigeration appliances.
- Ignore posters, stickers, banners, reflections, or non-functional units.
- Be confident: only report appliances you are reasonably sure about.
- Bounding Box format: [ymin, xmin, ymax, xmax] where values are scaled relative to 1000 (e.g., [100, 200, 900, 800]).

Return ONLY a JSON object with this EXACT structure:
{
  "results": [
    {
      "image_index": 1,
      "appliances_detected": true,
      "objects": [
        {
          "description": "glass door Coca-Cola branded cooler",
          "bounding_box": [150, 200, 850, 400],
          "confidence": 0.92
        }
      ]
    },
    {
      "image_index": 2,
      "appliances_detected": false,
      "objects": []
    }
  ]
}

You MUST return exactly the same number of entries in the results array as the number of images provided, in order.`;

export interface GeminiBoundingBoxResult {
    description: string;
    bounding_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
    confidence: number;
}

export interface PerImageBBoxResult {
    image_index: number;
    appliances_detected: boolean;
    objects: GeminiBoundingBoxResult[];
}

export interface GeminiBatchBBoxResponse {
    results: PerImageBBoxResult[];
}

function parseRetryDelay(errorMessage: string): number {
    const match = errorMessage.match(/retry\s+in\s+([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1])) + 3;
    return 35;
}

/**
 * Analyzes ALL store images in a single batched Gemini call to get bounding boxes.
 */
export async function detectBoundingBoxesInBatch(imageUrls: string[]): Promise<PerImageBBoxResult[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    const debug = process.env.DEBUG_DETECTION === "true";

    if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");
    if (imageUrls.length === 0) return [];

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const parts: any[] = [];
        parts.push({ text: DETECTION_PROMPT });

        console.log(`[RRIS] Fetching ${imageUrls.length} images for batch bounding box analysis...`);
        for (let i = 0; i < imageUrls.length; i++) {
            try {
                const response = await fetch(imageUrls[i]);
                if (!response.ok) {
                    parts.push({ text: `[Image ${i + 1}: UNAVAILABLE]` });
                    continue;
                }
                const contentType = response.headers.get("content-type") || "image/jpeg";
                const arrayBuffer = await response.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString("base64");

                parts.push({
                    inlineData: { data: base64Data, mimeType: contentType },
                });
                parts.push({ text: `[This is Image ${i + 1}]` });

            } catch (fetchErr: any) {
                parts.push({ text: `[Image ${i + 1}: UNAVAILABLE]` });
            }
        }

        let result;
        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[RRIS] Calling Gemini bounding box analysis (attempt ${attempt})...`);
                result = await model.generateContent({
                    contents: [{ role: "user", parts }],
                    generationConfig: {
                        temperature: 0.1,
                        topP: 0.95,
                        responseMimeType: "application/json",
                    },
                });
                break;
            } catch (err: any) {
                const errMsg = err.message || String(err);
                if (errMsg.includes("429") || errMsg.includes("Too Many Requests") || errMsg.includes("quota")) {
                    const retryDelay = parseRetryDelay(errMsg);
                    console.warn(`[RRIS] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${retryDelay}s...`);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
                } else {
                    console.warn(`[RRIS] Gemini attempt ${attempt} failed: ${errMsg}`);
                    if (attempt === maxRetries) throw err;
                    await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
                }
            }
        }

        if (!result) throw new Error("Failed to generate content after retries.");

        const responseText = result.response.text();
        if (debug) console.log(`[DEBUG] Gemini bounding box response: ${responseText}`);

        const parsed = JSON.parse(responseText) as GeminiBatchBBoxResponse;

        // Ensure we return an array with one entry per image
        const cleanResults: PerImageBBoxResult[] = [];
        for (let i = 0; i < imageUrls.length; i++) {
            const imageResult = parsed.results?.find(r => r.image_index === i + 1) || {
                image_index: i + 1,
                appliances_detected: false,
                objects: []
            };

            // Normalize coordinates
            imageResult.objects = (imageResult.objects || []).map(obj => {
                if (obj.bounding_box) {
                    obj.bounding_box = normalizeBoundingBox(obj.bounding_box);
                }
                return obj;
            });

            cleanResults.push(imageResult);
        }

        return cleanResults;
    } catch (error) {
        console.error("[RRIS] Error in detectBoundingBoxesInBatch:", error);
        return imageUrls.map((_, i) => ({
            image_index: i + 1,
            appliances_detected: false,
            objects: [],
        }));
    }
}

/**
 * Normalizes Gemini [ymin, xmin, ymax, xmax] coordinates to standard 0-1000 scale,
 * and fixes cases where it returns 0.0-1.0 floats.
 */
function normalizeBoundingBox(bbox: [number, number, number, number]): [number, number, number, number] {
    let [ymin, xmin, ymax, xmax] = bbox;
    if (ymax <= 1 && xmax <= 1) {
        // Returned 0.0-1.0 format, scale up to 1000
        ymin = Math.round(ymin * 1000);
        xmin = Math.round(xmin * 1000);
        ymax = Math.round(ymax * 1000);
        xmax = Math.round(xmax * 1000);
    }
    return [ymin, xmin, ymax, xmax] as [number, number, number, number];
}
