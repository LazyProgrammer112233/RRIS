import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;
env.remoteHost = 'https://hf-mirror.com';

async function testLocalClip() {
    console.log("Downloading/Loading Local CLIP model...");
    try {
        const cls = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
        console.log("Model loaded successfully!");

        // Test inference
        console.log("Testing inference on a placeholder image...");
        const result = await cls('https://placekitten.com/200/200', ["a photo of a cat", "a photo of a dog"]);
        console.log("Result:", result);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

testLocalClip();
