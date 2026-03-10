import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envUrlMatch = envFile.match(/GOOGLE_PLACES_API_KEY=(.*)/);
const envKeyMatch = envFile.match(/GEMINI_API_KEY=(.*)/);
const geminiKey = envKeyMatch ? envKeyMatch[1].trim() : '';
const placesKey = envUrlMatch ? envUrlMatch[1].trim() : '';

const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const photoUrls = Array(10).fill("https://maps.googleapis.com/maps/api/place/photo?maxwidth=1024&photo_reference=Aap_uEDQ0wO90OQ1w2iM9E1fH11aF2XzO9M9H9E_&key=" + placesKey);

async function test() {
    console.log("Starting debug run with 10 photos...");
    const fetchPromises = photoUrls.map(async (url, index) => {
        try {
            console.log(`Fetching photo ${index + 1}...`);
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = response.headers.get('content-type') || "image/jpeg";
            console.log(`Photo ${index + 1} size: ${base64Data.length} chars, type: ${mimeType}`);
            return { inlineData: { data: base64Data, mimeType } };
        } catch (err) {
            console.error("fetch hit error:", err);
            return null;
        }
    });

    const results = await Promise.all(fetchPromises);
    const parts = [{ text: "Are there fridges here?" }];

    for (let i = 0; i < results.length; i++) {
        if (results[i]) {
            parts.push(results[i]);
            parts.push({ text: `[This is image_${i + 1}]` });
        }
    }

    try {
        console.log("Sending to Gemini (Total Parts:", parts.length + ")...");
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        console.log("Success:", result.response.text());
    } catch (err) {
        console.error("Gemini Failure:", err);
    }
}

test();
