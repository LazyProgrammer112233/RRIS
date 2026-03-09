export function generateSummary(detectionsByImage: { objects: { category: string }[] }[]): {
    summaryText: string;
    counts: Record<string, number>;
} {
    const counts: Record<string, number> = {};

    // Aggregate counts across all images
    for (const result of detectionsByImage) {
        for (const obj of result.objects) {
            counts[obj.category] = (counts[obj.category] || 0) + 1;
        }
    }

    // Generate a short text summary
    let summaryText = "";
    const categoriesFound = Object.keys(counts);

    if (categoriesFound.length === 0) {
        summaryText = "No refrigeration appliances were detected in any of the store images.";
    } else {
        const descriptions = categoriesFound.map(cat => {
            const formattedName = cat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            return `${counts[cat]} ${formattedName}${counts[cat] > 1 ? 's' : ''}`;
        });

        summaryText = `This store contains the following refrigeration appliances: ${descriptions.join(', ')}.`;
    }

    return { summaryText, counts };
}

export function generateSingleImageSummary(objects: { category: string; confidence: number }[]): string {
    if (objects.length === 0) {
        return "No refrigeration appliance detected.";
    }

    const labels = objects.map(o => {
        const formattedName = o.category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return `${formattedName} (${o.confidence.toFixed(2)})`;
    });

    return `Detected: ${labels.join(', ')}`;
}
