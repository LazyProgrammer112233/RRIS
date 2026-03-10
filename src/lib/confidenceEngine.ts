/**
 * Confidence scoring engine.
 * Computes final confidence = Gemini detection confidence × CLIP similarity score.
 * Discards detections where final confidence < 0.60.
 */

export interface ScoredDetection {
    category: string;
    confidence: number;
    geminiConfidence: number;
    clipSimilarity: number;
    description: string;
}

const CONFIDENCE_THRESHOLD = 0.60;

/**
 * Computes the final confidence score for a detection.
 *
 * @param geminiConfidence - confidence from Gemini detection (0.0–1.0)
 * @param clipSimilarity - top similarity score from CLIP (0.0–1.0)
 * @returns final combined confidence
 */
export function computeConfidence(geminiConfidence: number, clipSimilarity: number): number {
    return geminiConfidence * clipSimilarity;
}

/**
 * Checks if a detection meets the minimum confidence threshold.
 */
export function meetsThreshold(finalConfidence: number): boolean {
    return finalConfidence >= CONFIDENCE_THRESHOLD;
}

/**
 * Filters an array of scored detections, keeping only those above the threshold.
 */
export function filterByConfidence(detections: ScoredDetection[]): ScoredDetection[] {
    const debug = process.env.DEBUG_DETECTION === "true";

    const filtered = detections.filter((d) => {
        const passes = meetsThreshold(d.confidence);
        if (debug && !passes) {
            console.log(
                `[DEBUG] Discarded detection: ${d.category} (confidence: ${d.confidence.toFixed(3)} < ${CONFIDENCE_THRESHOLD})`
            );
        }
        return passes;
    });

    if (debug) {
        console.log(
            `[DEBUG] Confidence filter: ${detections.length} detections → ${filtered.length} passed threshold (>= ${CONFIDENCE_THRESHOLD})`
        );
    }

    return filtered;
}
