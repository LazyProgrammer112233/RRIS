import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyBx68gIKkKoIbpM-YxhsUyvg6777B5_73I";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Test with a known retail store interior image
const TEST_URL = "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800";

async function testSingleImage() {
    console.log("=== Single Image Gemini Detection Test ===\n");

    // Fetch image
    console.log("Fetching test image...");
    const resp = await fetch(TEST_URL);
    console.log("Status:", resp.status, "Content-Type:", resp.headers.get("content-type"));
    const buf = Buffer.from(await resp.arrayBuffer());
    console.log("Image size:", buf.length, "bytes");

    if (buf.length < 1000) {
        console.log("WARNING: Image too small, might not be an actual image!");
        console.log("First 200 bytes (as string):", buf.toString("utf8", 0, 200));
    }

    const prompt = `Analyze this image. Detect any refrigeration appliances visible.

For each appliance, classify into one of: fridge, visi_cooler, beverage_cooler, chest_freezer, ice_cream_freezer, multideck_open_chiller, refrigerated_display_counter, dairy_milk_chiller, upright_freezer, walk_in_cold_room, upright_glass_door_refrigerator, sliding_glass_top_freezer, island_freezer.

Return ONLY JSON:
{
  "appliances_detected": true/false,
  "objects": [{ "category": "category_name", "description": "brief description", "confidence": 0.85 }]
}`;

    console.log("\nCalling Gemini 2.0 Flash...");
    const result = await model.generateContent({
        contents: [{
            role: "user",
            parts: [
                { text: prompt },
                { inlineData: { data: buf.toString("base64"), mimeType: resp.headers.get("content-type") || "image/jpeg" } }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            responseMimeType: "application/json"
        }
    });

    const text = result.response.text();
    console.log("\nGemini response:", text);
    const parsed = JSON.parse(text);
    console.log("\nParsed result:", JSON.stringify(parsed, null, 2));

    if (parsed.appliances_detected) {
        console.log("\n✓ SUCCESS: Gemini detected appliances!");
        for (const obj of parsed.objects) {
            console.log(`  - ${obj.category}: ${obj.description} (confidence: ${obj.confidence})`);
        }
    } else {
        console.log("\n✗ No appliances detected in this image.");
    }
}

testSingleImage().catch(e => console.error("ERROR:", e.message));
