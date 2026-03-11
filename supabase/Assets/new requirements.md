1. Purpose:
Determine whether a retail outlet contains a fridge or cooling device using only the provided outlet images.
This is a two-stage reasoning workflow with built-in self-verification at each stage to minimize hallucination and improve precision in Indian retail contexts (kirana stores, general trade, modern trade).

2. Input Contract
The model receives a structured payload of outlet images.
{
  "images": ["image_1", "image_2", "image_3", "..."]
}
Image characteristics:
Unordered; no guaranteed sequence
May include: interior views, shelves, counters, equipment, refrigerators, freezers, coolers, beverage chillers, exterior shots, signage
Quality varies — low-light, partial occlusion, reflections, and poster/sticker clutter are common in Indian general trade

3. Definitions
3.1 Outlet Types
   Type Indicators     Supermarket Multiple aisles, organized shelving, billing counters, branded signage, wide floor area   Hypermarket Very large floor area, multiple departments, trolleys/carts, warehouse-style shelving   Kirana / Small Retail Single counter, limited floor area, cluttered shelving, hand-painted signage, narrow entrance   Uncertain Insufficient visual evidence to classify confidently   Decision rule: If outlet is classified as supermarket or hypermarket, fridges are assumed present (these formats universally contain refrigeration). No further detection is needed.
3.2 Cooling Devices (Valid Detections)
Any of the following counts as a positive detection:
Refrigerator (single-door, double-door)
Beverage cooler (branded Coca-Cola, Pepsi, Red Bull, etc.)
Ice cream freezer (Kwality Walls, Amul, Baskin Robbins chest units)
Glass-door display fridge
Chest freezer (top-open)
Commercial cooling cabinet
Bottle chiller / visi-cooler
3.3 What Does NOT Count
Posters, stickers, or cardboard cutouts depicting fridges or cold beverages
Reflections on glass that resemble cooling units
Non-functional or clearly decommissioned units (rusted, unplugged, used as storage shelf)
Air conditioning units (wall-mounted split ACs, ceiling fans)

4. Workflow — Chain of Verification
Stage 1: Outlet Type Classification
Scope: Analyze the first 3–5 images to determine outlet format.
Step 1A — Initial Classification
Examine images for spatial layout, shelving density, aisle structure, billing infrastructure, and signage.
Classify as one of:
supermarket
hypermarket
kirana / small retail
uncertain
Step 1B — Verification (Self-Check)
Before committing to classification, answer these verification questions:
"Do I see multiple organized aisles with standardized shelving?" — If yes, leans supermarket/hypermarket.
"Is the floor area clearly larger than a single-room shop?" — If yes, supports modern trade classification.
"Are there visible billing counters, trolleys, or electronic POS systems?" — Strong signal for supermarket/hypermarket.
"Could this be a large kirana that merely has wide shelving?" — Challenge your initial classification.
"Am I basing this on a single image or corroborating across multiple images?" — Require at least 2 images to agree.
Step 1C — Decision Gate
   Classification Action     supermarket or hypermarket (confirmed by verification) → Return contains_fridge: true with reason. Stop.   kirana / small retail → Proceed to Stage 2   uncertain → Proceed to Stage 2 (treat as small retail)   
Stage 2: Cooling Device Detection
Scope: Analyze ALL provided images for visible cooling equipment.
Step 2A — Scan Each Image
For each image, look for:
Glass-door beverage coolers (often branded — Coca-Cola red, Pepsi blue, Sprite green)
Chest freezers (typically white, top-opening lid, often near entrance)
Commercial refrigerators (steel body, compressor hum irrelevant — focus on form factor)
Ice cream storage units (Kwality Walls blue/white chest freezers, Amul branded units)
Visi-coolers (vertical glass-front units, common brand asset in Indian retail)
Mini-fridges or under-counter cooling units
Step 2B — Verification (Self-Check Per Image)
For every candidate detection, answer:
"Can I see the physical structure of the cooling unit — door, handle, compressor housing, or temperature display?" — At least one structural element must be visible.
"Is this a real 3D object in the scene, or a flat 2D image (poster, sticker, banner)?" — Check for depth cues, shadows, perspective distortion.
"Does the object have realistic proportions for a cooling device?" — A cooler is typically 0.5m–2m tall and has consistent depth.
"Could this be a glass cabinet, display case, or non-refrigerated shelf?" — Look for compressor, brand stickers indicating cooling, condensation, or visible temperature dials.
"Am I confident enough to stake a binary decision on this detection?" — If confidence < 70%, do NOT count as detected.
Step 2C — Aggregate Decision
   Outcome Action     At least one verified cooling device found → Return contains_fridge: true with evidence image   No cooling device passes verification → Return contains_fridge: false   
5. Output Format
Return a structured JSON response in exactly one of three forms:
Case 1 — Fridge Inferred from Store Type
{
  "contains_fridge": true,
  "detection_method": "store_type_inference",
  "outlet_type": "supermarket",
  "reason": "Outlet classified as supermarket/hypermarket — refrigeration is standard in this format",
  "evidence_image": null,
  "confidence": "high",
  "verification_notes": "Multiple aisles visible in images 1, 3. Billing counter with POS visible in image 2."
}
Case 2 — Fridge Detected in Image
{
  "contains_fridge": true,
  "detection_method": "visual_detection",
  "outlet_type": "kirana / small retail",
  "reason": "Branded beverage cooler detected in image",
  "evidence_image": "image_4",
  "confidence": "high",
  "verification_notes": "Glass-door vertical cooler with Coca-Cola branding visible. 3D object with shadow and depth. Handle and temperature dial visible."
}
Case 3 — No Fridge Detected
{
  "contains_fridge": false,
  "detection_method": "visual_detection",
  "outlet_type": "kirana / small retail",
  "reason": "No cooling device detected in provided images",
  "evidence_image": null,
  "confidence": "medium",
  "verification_notes": "Reviewed all 5 images. Shelving and counter visible but no cooling equipment identified. One image (image_3) showed a reflective surface initially considered, but verified as glass display case without cooling mechanism."
}

6. Gemini Vision API — Prompt Template
Below is the production-ready prompt for use with Gemini 1.5 Pro Vision or Gemini 2.0 Flash.
You are a retail outlet analyst specializing in Indian FMCG distribution. Your task is to determine whether a retail outlet contains a fridge or cooling device based on the provided images.

## Your Approach

You MUST follow this exact two-stage workflow:

### STAGE 1 — Outlet Type Classification
Examine the first 3–5 images. Classify the outlet as one of: supermarket, hypermarket, kirana/small retail, or uncertain.

Before committing to your classification, verify by answering:
- Do I see multiple organized aisles with standardized shelving?
- Is the floor area clearly larger than a single-room shop?
- Are there billing counters, trolleys, or POS systems?
- Could this be a large kirana mistaken for modern trade?
- Am I corroborating across at least 2 images?

IF supermarket or hypermarket → return result immediately (fridges assumed).
OTHERWISE → proceed to Stage 2.

### STAGE 2 — Cooling Device Detection
Analyze ALL images for: glass-door beverage coolers, chest freezers, commercial refrigerators, ice cream freezers, visi-coolers, bottle chillers.

For each candidate detection, verify:
- Can I see physical structure (door, handle, compressor, temperature display)?
- Is this a real 3D object or a poster/sticker/banner?
- Does it have realistic proportions for a cooling device?
- Could it be a non-refrigerated glass cabinet or shelf?
- Is my confidence above 70%?

Only count detections that pass ALL verification checks.

## Rules
- Only rely on visual evidence from the provided images.
- Do NOT assume a fridge exists unless the outlet is supermarket/hypermarket OR you visually detect one.
- Ignore posters, stickers, reflections, and non-functional decommissioned units.
- If detection confidence is low, classify as no fridge.
- Always show your reasoning in verification_notes.

## Output
Respond with ONLY a JSON object in this exact schema:
{
  "contains_fridge": boolean,
  "detection_method": "store_type_inference" | "visual_detection",
  "outlet_type": "supermarket" | "hypermarket" | "kirana / small retail" | "uncertain",
  "reason": string,
  "evidence_image": string | null,
  "confidence": "high" | "medium" | "low",
  "verification_notes": string
}

7. API Integration Example (Gemini)
import google.generativeai as genai
import json
import base64
from pathlib import Path

genai.configure(api_key="YOUR_API_KEY")

def detect_fridge(image_paths: list[str]) -> dict:
    """
    Run fridge detection on a list of outlet images.
    
    Args:
        image_paths: List of file paths to outlet images
    
    Returns:
        Structured detection result dict
    """
    model = genai.GenerativeModel("gemini-1.5-pro")  # or "gemini-2.0-flash"
    
    # Build content parts
    parts = []
    
    # System prompt (loaded from prompt template above)
    parts.append(SYSTEM_PROMPT)
    
    # Attach images with labels
    for i, path in enumerate(image_paths):
        img_data = Path(path).read_bytes()
        parts.append({
            "mime_type": "image/jpeg",
            "data": base64.b64encode(img_data).decode()
        })
        parts.append(f"[This is image_{i+1}]")
    
    parts.append("Now analyze these outlet images and return the JSON result.")
    
    response = model.generate_content(
        parts,
        generation_config={
            "temperature": 0.1,       # Low temperature for deterministic output
            "top_p": 0.95,
            "max_output_tokens": 1024,
            "response_mime_type": "application/json"  # Force JSON output
        }
    )
    
    return json.loads(response.text)

8. Refinements — Senior Prompt Engineering Notes
8.1 Why Chain of Verification Matters Here
The naive approach ("Does this image contain a fridge?") suffers from two failure modes in Indian retail:
False positives from 2D assets — Branded cooler posters, stickers on shutters, and printed banners are everywhere in Indian general trade. Without the verification step asking "Is this a real 3D object?", models routinely hallucinate fridge presence from flat promotional material.
False negatives from unfamiliar form factors — Indian kirana cooling devices include under-counter chest freezers partially hidden by merchandise, branded visi-coolers wedged into narrow spaces, and makeshift cooling units. The explicit checklist of form factors in Stage 2A compensates for this.
8.2 Temperature and Decoding Strategy
Use temperature 0.1 (not 0.0 — some models behave erratically at exactly zero).
Use response_mime_type: "application/json" with Gemini to enforce structured output.
For OpenAI-compatible endpoints, use function calling / structured outputs instead of free-text JSON parsing.
8.3 Image Ordering and Batching
Feed images in consistent order with explicit labels (image_1, image_2, ...) so the model can reference them in evidence_image.
For outlets with 10+ images, batch into groups of 5 and run Stage 2 per batch, then aggregate. This avoids context window dilution where later images get less attention.
8.4 Confidence Calibration
The confidence field is a forcing function — it makes the model commit to its certainty level, which empirically reduces both hallucination and hedge-everything behavior. During evaluation, flag any response where confidence: high but the detection is wrong — these are the most dangerous errors.
8.5 Edge Cases to Monitor
 Scenario Expected Behavior     All images are exterior shots only contains_fridge: false (no interior evidence)   Single blurry image contains_fridge: false, confidence: low   Large kirana that looks like a mini-supermarket Should NOT trigger store_type_inference — verify with the 5-question checklist   Decommissioned fridge used as storage shelf Should NOT count as cooling device   Branded cooler visible but doors are missing Edge case — count as detected if compressor/cooling mechanism still visible   8.6 Evaluation Rubric
A valid output must:
[ ] Follow the defined two-stage workflow (not skip to detection)
[ ] Provide structured JSON matching the exact schema
[ ] Include evidence_image reference when detection occurs
[ ] Include non-empty verification_notes showing reasoning
[ ] Not hallucinate cooling devices from posters, reflections, or ambiguous objects
[ ] Correctly distinguish modern trade from large kiranas
[ ] Return confidence: low (not high) when evidence is marginal





8.7 Prompt Versioning
   Version Change Date     v1.0 Initial two-stage workflow —   v2.0 Added Chain of Verification self-checks, Gemini-specific prompt template, confidence field, verification_notes, expanded negative definitions, Indian retail edge cases, API integration example March 2026   
