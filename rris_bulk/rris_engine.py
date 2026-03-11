import os
import json
import re
import asyncio
import google.generativeai as genai
from PIL import Image
import yaml

# Load config
with open(os.path.join(os.path.dirname(__file__), "config.yaml"), 'r') as f:
    config = yaml.safe_load(f)

SYSTEM_PROMPT = """
You are a retail outlet analyst specializing in Indian FMCG distribution. Your task is to determine whether a retail outlet contains a fridge or cooling device based on the provided images.

## Your Approach

You MUST follow this exact two-stage workflow:

### STAGE 1 — Outlet Type Classification
Examine the first 3–5 images. Classify the outlet as one of: supermarket, hypermarket, kirana / small retail, or uncertain.

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
"""

class RRISEngine:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(config.get('model_name', 'gemini-2.0-flash'))

    async def analyze_store(self, image_paths):
        """
        Analyzes a set of images for a single store.
        """
        if not image_paths:
            return {"error": "No images provided"}

        parts = [SYSTEM_PROMPT]
        loaded_images = []
        
        # Limit images for context safety
        limit = config.get('image_limit_per_store', 10)
        
        for i, path in enumerate(image_paths[:limit]):
            try:
                img = Image.open(path)
                # Ensure image is in a friendly format/size if needed (Gemini handles PIL)
                parts.append(img)
                parts.append(f"[This is image_{i+1}]")
                loaded_images.append(img)
            except Exception as e:
                print(f"Error loading image {path}: {e}")
                continue

        if not loaded_images:
            return {"error": "Failed to load any images"}

        parts.append("Now analyze these outlet images and return the JSON result.")

        # Retry logic
        max_retries = config.get('max_retries', 3)
        for attempt in range(max_retries):
            try:
                # Use to_thread for the blocking API call if not using async client
                # However, google-generativeai doesn't have a built-in async generate_content 
                # that works well with PIL images in all versions, so we use run_in_executor
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, 
                    lambda: self.model.generate_content(
                        parts,
                        generation_config={"temperature": 0.1}
                    )
                )

                if not response or not response.text:
                    continue

                text = response.text
                json_match = re.search(r'\{.*\}', text, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
                
            except Exception as e:
                print(f"Attempt {attempt+1} failed: {e}")
                if attempt == max_retries - 1:
                    return {"error": str(e)}
                await asyncio.sleep(2 ** attempt) # Exponential backoff

        return {"error": "Failed after retries"}
