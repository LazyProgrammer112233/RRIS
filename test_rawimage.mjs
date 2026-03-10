import { pipeline, env, RawImage } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;
env.remoteHost = 'https://hf-mirror.com';

async function testLocalClip() {
    console.log("Downloading/Loading Local CLIP model...");
    try {
        const cls = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
        console.log("Model loaded successfully!");

        // create a fake valid 1x1 jpeg buffer to test RawImage.read
        const imgBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAABf/xAAXAQEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAER/9oADAMBAAIAAwAAECP/xAAXEQEBAQEAAAAAAAAAAAAAAAAAAQIR/9oACAEDAQE/EBr/AP/EABgRAQADAQAAAAAAAAAAAAAAAAERAAAh/9oACAECAQE/EEn/xAAXEAACAwAAAAAAAAAAAAAAAAABEQAh/9oACAEBAAE/EAQ//9k=', 'base64');

        const rawImage = await RawImage.read(imgBuffer);
        const result = await cls(rawImage, ["a photo of a cat", "a photo of a dog"]);
        console.log("Result:", result);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}

testLocalClip();
