Project: High-Accuracy FMCG Asset Detection Engine
1. Executive Summary & Context
Goal: To build a robust pipeline that extracts store listing images from Google Maps and performs a high-precision audit of FMCG assets (Visi Coolers, Chest Freezers, Branded Racks).
Previous Failures: The system failed due to URL redirect issues and generic vision prompts that lacked FMCG domain knowledge.
New Strategy: Use a Two-Stage Vision Analysis combined with Chain-of-Thought (CoT) prompting and high-res image manipulation.

2. Phase 1: Deep-Link Data Retrieval (Browser Agent)
Antigravity must use its Integrated Browser Tool to handle the dynamic nature of Google Maps.

Extraction Logic:
URL Resolution: Take the goo.gl or google.com/maps share URL and navigate. Wait for the final redirect to the store's "Place ID" page.

Photo Navigation: Identify and click the "Photos" tab or the "All" photos category.

High-Res URL Transformation: * Locate the source URLs (typically hosted on lh3.googleusercontent.com).

CRITICAL: Scraped URLs often have a resolution suffix like =w100-h100-p. You must programmatically replace these suffixes with =s2048 or =s0 to fetch the original high-resolution file.

Metadata Capture: Store the image URL along with the "User-Uploaded" or "Street View" tag if available.

3. Phase 2: Vision Analysis Strategy (Gemini 2.5 Flash)
Implement the Prompt Engineering Strategy using a two-stage recursive approach to maximize accuracy.

Stage 1: Localization & Inventory
Task: Identify the presence and location of assets.
System Prompt: > "You are an expert Retail Auditor. Analyze this retail environment. Identify every instance of cooling equipment (Visi Coolers, Chest Freezers) and branded display racks.

Output Format: Return a JSON list of objects: {"asset_type": "string", "box_2d": [ymin, xmin, ymax, xmax], "confidence": "float"}.
Constraint: Do not classify the brand yet. Focus only on accurate bounding boxes."

Stage 2: Specific Asset Auditing (Crop & Classify)
Task: For every bounding box detected in Stage 1, crop the image and perform a secondary analysis.
System Prompt (The FMCG Dictionary):

"Analyze this cropped image of a retail asset. Use the following definitions:

Visi Cooler: Vertical unit, transparent glass door, internal shelves, used for chilled beverages.

Chest Freezer: Horizontal unit, sliding glass or solid lid, used for frozen goods/ice cream.

Branded Rack: Non-electrical display stands with prominent brand headers.

Chain-of-Thought (CoT) Requirement:

Identify the primary brand logo visible (e.g., Coca-Cola, Pepsi, Amul).

Determine if the unit is 'Pure' (only one brand) or 'Mixed' (multiple brands inside).

Assess the 'Stock Level' (Empty, Partially Stocked, Full).

Final Output: A structured JSON summary of the specific asset."

4. Implementation Instructions for Antigravity
A. Environment Setup
Use the provided Gemini 2.5 Flash API Key.

Utilize PIL (Pillow) or OpenCV for the image cropping logic between Stage 1 and Stage 2.

B. Workflow Execution Script
Initialize Browser: Navigate and extract top 10 most relevant store images.

Run Stage 1: Batch process images to find all asset coordinates.

Run Stage 2: Iterate through coordinates, crop the original high-res image, and call the classification prompt.

Consolidate: Generate a final audit_report.json containing the store name, address (from Maps), and a detailed list of detected assets with their brand/status.

5. Error Handling & Edge Cases
Redirect Loops: If the browser fails to resolve the Maps URL after 3 attempts, fallback to searching the store name + city on Google Search to find the listing.

Low Resolution: If an image is below 720p after the URL transformation, flag it as 'Low Confidence' in the final report.

Antigravity, please confirm once the Browser Agent has successfully resolved the first test URL and extracted the high-res links.