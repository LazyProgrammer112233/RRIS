/**
 * Quick test of HuggingFace API reachability and CLIP endpoint
 */
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) env[t.substring(0, i)] = t.substring(i + 1);
}

const HF_KEY = env.CLIP_API_KEY || env.VISION_MODEL_API_KEY;
console.log("HF Key:", HF_KEY ? HF_KEY.substring(0, 10) + "..." : "MISSING");

// Test 1: Can we reach HuggingFace at all?
console.log("\n1. Testing HuggingFace inference API reachability...");
try {
    const r = await fetch("https://api-inference.huggingface.co/status/openai/clip-vit-base-patch32", {
        headers: { Authorization: `Bearer ${HF_KEY}` },
    });
    console.log(`  Status: ${r.status}`);
    console.log(`  Body: ${await r.text()}`);
} catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
}

// Test 2: Try the router URL (same pattern as VISION_MODEL_API_URL)
console.log("\n2. Testing HuggingFace router URL...");
const routerUrl = "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32";
try {
    const img = await fetch("https://placekitten.com/200/200");
    const buf = Buffer.from(await img.arrayBuffer());
    console.log(`  Image: ${buf.length} bytes`);

    const r = await fetch(routerUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${HF_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            inputs: buf.toString("base64"),
            parameters: {
                candidate_labels: ["a cat", "a dog", "a refrigerator"],
            },
        }),
    });
    console.log(`  Status: ${r.status}`);
    console.log(`  Body: ${await r.text()}`);
} catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
}

// Test 3: Try with the VISION_MODEL_API_URL pattern
console.log("\n3. Testing HuggingFace DETR URL (existing working endpoint)...");
try {
    const r = await fetch(env.VISION_MODEL_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${HF_KEY}` },
        body: Buffer.from(await (await fetch("https://placekitten.com/200/200")).arrayBuffer()),
    });
    console.log(`  Status: ${r.status}`);
    const body = await r.text();
    console.log(`  Body: ${body.substring(0, 200)}`);
} catch (e) {
    console.log(`  ✗ FAILED: ${e.message}`);
}

console.log("\n=== DONE ===");
