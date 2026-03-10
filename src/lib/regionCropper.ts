import { Jimp } from "jimp";

/**
 * Fetches an image from a URL and crops a specific bounding box region.
 * Returns the cropped region as a Node Buffer (JPEG).
 *
 * @param imageUrl - URL of the source image
 * @param boundingBox - [ymin, xmin, ymax, xmax] coordinates (scaled 0-1000)
 * @returns cropped image Buffer
 */
export async function cropImageRegion(
    imageUrl: string,
    boundingBox: [number, number, number, number]
): Promise<Buffer | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.warn(`[RRIS] Failed to fetch image for cropping: ${imageUrl}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        // Load image entirely in JS, avoiding VIPS native crashes
        const image = await Jimp.read(imageBuffer);
        const imgWidth = image.bitmap.width;
        const imgHeight = image.bitmap.height;

        const [ymin_scaled, xmin_scaled, ymax_scaled, xmax_scaled] = boundingBox;

        // Convert 0-1000 scaled coordinates to pixel coordinates
        let ymin = Math.floor((ymin_scaled / 1000) * imgHeight);
        let xmin = Math.floor((xmin_scaled / 1000) * imgWidth);
        let ymax = Math.ceil((ymax_scaled / 1000) * imgHeight);
        let xmax = Math.ceil((xmax_scaled / 1000) * imgWidth);

        // Clamp to image edges securely
        xmin = Math.max(0, Math.min(xmin, imgWidth - 1));
        ymin = Math.max(0, Math.min(ymin, imgHeight - 1));
        xmax = Math.max(xmin + 1, Math.min(xmax, imgWidth));
        ymax = Math.max(ymin + 1, Math.min(ymax, imgHeight));

        let width = xmax - xmin;
        let height = ymax - ymin;

        if (xmin + width > imgWidth) width = imgWidth - xmin;
        if (ymin + height > imgHeight) height = imgHeight - ymin;

        if (width < 10 || height < 10) {
            console.warn(`[RRIS] Bounding box too small: ${width}x${height}, skipping crop.`);
            return null;
        }

        image.crop({ x: xmin, y: ymin, w: width, h: height });

        // Export to JPEG Buffer
        const croppedBuffer = await image.getBuffer("image/jpeg");
        return croppedBuffer;
    } catch (error) {
        console.error("[RRIS] Error in cropImageRegion:", error);
        return null;
    }
}
