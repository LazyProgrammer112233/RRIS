/**
 * Diagnostic script to test each pipeline stage independently.
 * Run from project root: node test_pipeline_diag.mjs
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";

// Load env manually
const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
        env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
    }
}

const GEMINI_API_KEY = env.GEMINI_API_KEY;
const CLIP_API_URL = env.CLIP_API_URL;
const CLIP_API_KEY = env.CLIP_API_KEY || env.VISION_MODEL_API_KEY;

const TEST_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Coca-Cola_Visi_Cooler.jpg/440px-Coca-Cola_Visi_Cooler.jpg";

console.log("=== PIPELINE DIAGNOSTIC ===\n");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "✓ Set" : "✗ MISSING");
console.log("CLIP_API_URL:", CLIP_API_URL || "NOT SET");
console.log("CLIP_API_KEY:", CLIP_API_KEY ? "✓ Set" : "✗ MISSING");

// === STAGE 1: Test Gemini Detection ===
console.log("\n--- STAGE 1: Gemini Vision Detection ---");
try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const imgResp = await fetch(TEST_IMAGE_URL);
    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
    const base64 = imgBuf.toString("base64");
    const mimeType = imgResp.headers.get("content-type") || "image/jpeg";

    console.log(`Image fetched: ${imgBuf.length} bytes, ${mimeType}`);

    const prompt = `Analyze this retail store image.

Detect refrigeration appliances.

Return JSON only.

{
  "appliances_detected": true/false,
  "objects": [
    {
      "description": "",
      "bounding_box": [x1, y1, x2, y2],
      "confidence": 0.0
    }
  ]
}`;

    const result = await model.generateContent({
        contents: [{
            role: "user",
            parts: [
                { text: prompt },
                { inlineData: { data: base64, mimeType } },
            ],
        }],
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            responseMimeType: "application/json",
        },
    });

    const text = result.response.text();
    console.log("Gemini raw response:", text);
    const parsed = JSON.parse(text);
    console.log("Gemini parsed:", JSON.stringify(parsed, null, 2));

    if (parsed.appliances_detected && parsed.objects?.length > 0) {
        console.log("✓ Gemini detected appliances!");
        for (const obj of parsed.objects) {
            const bb = obj.bounding_box;
            console.log(`  Object: "${obj.description}", bbox: [${bb}], confidence: ${obj.confidence}`);
            if (bb) {
                const [x1, y1, x2, y2] = bb;
                if (x2 <= 1 && y2 <= 1) {
                    console.log("  ⚠ Bounding box appears NORMALIZED (0-1 range)!");
                } else if (x2 > 1000 && y2 > 1000) {
                    console.log("  ⚠ Bounding box appears to use 1000-scale normalization!");
                } else {
                    console.log(`  ✓ Bounding box looks like pixel coords (image is 440px wide)`);
                }
            } else {
                console.log("  ⚠ NO bounding box returned!");
            }
        }
    } else {
        console.log("✗ Gemini did NOT detect any appliances");
    }
} catch (e) {
    console.error("✗ Gemini FAILED:", e.message);
}

// === STAGE 2: Test CLIP API with various formats ===
console.log("\n--- STAGE 2: CLIP API Classification ---");
const candidateLabels = [
    "a visi cooler refrigerator in a retail store",
    "a beverage cooler refrigerator",
    "a chest freezer used in a grocery store",
    "a horizontal ice cream freezer",
    "a multideck open chiller in a supermarket",
];

try {
    const imgResp = await fetch(TEST_IMAGE_URL);
    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
    const base64 = imgBuf.toString("base64");

    // Test Format A: inputs.image
    console.log("\nFormat A: { inputs: { image: base64 }, parameters: { candidate_labels } }");
    try {
        const respA = await fetch(CLIP_API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CLIP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: { image: base64 }, parameters: { candidate_labels: candidateLabels } }),
        });
        console.log(`  Status: ${respA.status}`);
        console.log(`  Body: ${(await respA.text()).substring(0, 300)}`);
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Test Format B: inputs = base64 string
    console.log("\nFormat B: { inputs: base64, parameters: { candidate_labels } }");
    try {
        const respB = await fetch(CLIP_API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CLIP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: base64, parameters: { candidate_labels: candidateLabels } }),
        });
        console.log(`  Status: ${respB.status}`);
        console.log(`  Body: ${(await respB.text()).substring(0, 300)}`);
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Test Format C: data URI
    console.log("\nFormat C: { inputs: 'data:image/jpeg;base64,...', parameters: { candidate_labels } }");
    try {
        const respC = await fetch(CLIP_API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CLIP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: `data:image/jpeg;base64,${base64}`, parameters: { candidate_labels: candidateLabels } }),
        });
        console.log(`  Status: ${respC.status}`);
        console.log(`  Body: ${(await respC.text()).substring(0, 300)}`);
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Test Format D: image URL
    console.log("\nFormat D: { inputs: 'https://...image_url', parameters: { candidate_labels } }");
    try {
        const respD = await fetch(CLIP_API_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${CLIP_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: TEST_IMAGE_URL, parameters: { candidate_labels: candidateLabels } }),
        });
        console.log(`  Status: ${respD.status}`);
        console.log(`  Body: ${(await respD.text()).substring(0, 300)}`);
    } catch (e) { console.log(`  Error: ${e.message}`); }

    // Test Format E: binary body
    console.log("\nFormat E: Binary image body with candidate_labels as query param");
    try {
        const url = new URL(CLIP_API_URL);
        const respE = await fetch(url.toString(), {
            method: "POST",
            headers: { Authorization: `Bearer ${CLIP_API_KEY}` },
            body: imgBuf,
        });
        console.log(`  Status: ${respE.status}`);
        console.log(`  Body: ${(await respE.text()).substring(0, 300)}`);
    } catch (e) { console.log(`  Error: ${e.message}`); }

} catch (e) {
    console.error("✗ CLIP stage FAILED:", e.message);
}

console.log("\n=== DIAGNOSTIC COMPLETE ===");
