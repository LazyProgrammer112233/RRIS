/**
 * Appliance taxonomy mapper.
 * Maps CLIP prompt labels to canonical appliance category names.
 */

// Canonical categories from the requirements
export type ApplianceCategory =
    | "fridge"
    | "visi_cooler"
    | "upright_glass_door_refrigerator"
    | "multideck_open_chiller"
    | "beverage_cooler"
    | "chest_freezer"
    | "sliding_glass_top_freezer"
    | "ice_cream_freezer"
    | "island_freezer"
    | "upright_freezer"
    | "refrigerated_display_counter"
    | "dairy_milk_chiller"
    | "walk_in_cold_room";

// Map from CLIP prompt label → canonical category
const PROMPT_TO_CATEGORY: Record<string, ApplianceCategory> = {
    "a visi cooler refrigerator in a retail store": "visi_cooler",
    "a beverage cooler refrigerator": "beverage_cooler",
    "a chest freezer used in a grocery store": "chest_freezer",
    "a horizontal ice cream freezer": "ice_cream_freezer",
    "a multideck open chiller in a supermarket": "multideck_open_chiller",
    "a refrigerated display counter": "refrigerated_display_counter",
    "a dairy milk chiller refrigerator": "dairy_milk_chiller",
    "an upright freezer appliance": "upright_freezer",
    "a walk in cold room refrigerator door": "walk_in_cold_room",
    "a glass door upright refrigerator in a store": "upright_glass_door_refrigerator",
    "a sliding glass top freezer in a retail store": "sliding_glass_top_freezer",
    "an island freezer in a supermarket": "island_freezer",
    "a standard fridge refrigerator": "fridge",
};

/**
 * Maps a CLIP prompt label to its canonical appliance category.
 * Falls back to "fridge" if no mapping is found.
 */
export function mapToCategory(clipLabel: string): ApplianceCategory {
    return PROMPT_TO_CATEGORY[clipLabel] || "fridge";
}

/**
 * Returns a human-readable display name for a category.
 */
export function getCategoryDisplayName(category: ApplianceCategory): string {
    return category
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Returns all valid appliance categories.
 */
export function getAllCategories(): ApplianceCategory[] {
    return Object.values(PROMPT_TO_CATEGORY);
}
