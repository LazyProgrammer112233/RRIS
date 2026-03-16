import os
import json
import re
import asyncio
import google.generativeai as genai
from PIL import Image
import yaml

import yaml
import requests
import base64
from io import BytesIO

# Load config
with open(os.path.join(os.path.dirname(__file__), "config.yaml"), 'r') as f:
    config = yaml.safe_load(f)

# Hugging Face CLIP Configuration
CLIP_API_URL = "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32"
# Labels for zero-shot classification
CLIP_OUTLET_LABELS = [
    "a photo of a supermarket or hypermarket with many aisles",
    "a photo of a small kirana store or traditional retail shop",
    "a photo of a pharmacy or medical store",
    "a photo of a restaurant or cafe",
    "a photo of a street view or non-commercial building",
    "a photo of a clear refrigeration cooling device (fridge/freezer)",
    "a photo that is blurry, dark, or unidentifiable"
]

CLIP_LABEL_MAP = {
    "a photo of a supermarket or hypermarket with many aisles": "supermarket",
    "a photo of a small kirana store or traditional retail shop": "kirana / small retail",
    "a photo of a pharmacy or medical store": "pharma store",
    "a photo of a restaurant or cafe": "restaurant/cafe",
    "a photo of a street view or non-commercial building": "non-commercial",
    "a photo of a clear refrigeration cooling device (fridge/freezer)": "cooler_detected",
    "a photo that is blurry, dark, or unidentifiable": "unidentifiable"
}

SYSTEM_PROMPT = """
You are a retail outlet analyst specializing in Indian FMCG distribution. Your task is to analyze retail outlet images to identify and count specific cooling and branding assets.

## STAGE — Detailed Asset Analysis
Analyze ALL images for specific refrigeration asset categories.

### Asset Categories to Identify:
1. Visi Coolers (Vertical glass door fridges)
2. Chest Freezers (Horizontal units)
3. Deep Freezers (Large horizontal units)
4. Beverage Chillers (Open-front multidecks)
5. Branded Counter-top Coolers

### CRITICAL RULES:
- ONLY rely on visual evidence from the provided images. 
- IGNORE store names, metadata, or external data.
- If an image is blurry or doesn't clearly show an asset, do NOT count it.
- If there are no images, you cannot confirm anything.
- Do NOT judge by name or ratings.

## Output Requirements (STRICT JSON ONLY)
{
  "contains_fridge": boolean,
  "outlet_type": "supermarket" | "hypermarket" | "kirana / small retail" | "uncertain",
  "store_category": string, (predicted store type based ONLY on images)
  "asset_count": integer,
  "appliance_types": string, (comma-separated list of EXACT categories found)
  "asset_breakdown": string,
  "confidence": "high" | "medium" | "low",
  "reason": string,
  "verification_notes": string
}
"""

class CLIPClassifier:
    def __init__(self, api_key):
        self.api_key = api_key
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def classify_images(self, image_paths):
        """
        Inference call to Hugging Face CLIP model.
        """
        results = []
        for path in image_paths:
            try:
                with open(path, "rb") as f:
                    img_data = f.read()
                
                payload = {
                    "inputs": base64.b64encode(img_data).decode("utf-8"),
                    "parameters": {"candidate_labels": CLIP_OUTLET_LABELS}
                }
                
                # HF Inference API usually expects raw bytes for image or JSON with inputs
                # Using requests.post for simplicity, can be wrapped in loop.run_in_executor
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.post(CLIP_API_URL, headers=self.headers, json=payload, timeout=10)
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        # Top result
                        top = data[0]
                        results.append({
                            "label": CLIP_LABEL_MAP.get(top["label"], "uncertain"),
                            "score": top["score"]
                        })
                else:
                    print(f"[CLIP] API Error: {response.text}")
            except Exception as e:
                print(f"[CLIP] Error processing {path}: {e}")
        
        return results

class RRISEngine:
    def __init__(self, api_key, clip_api_key=None):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(config.get('model_name', 'gemini-2.0-flash'))
        self.clip = CLIPClassifier(clip_api_key or api_key) # Use same key if HF not separate

    async def analyze_store(self, image_paths):
        """
        Analyzes a set of images using CLIP-first screening, then Gemini if needed.
        """
        if not image_paths:
            return {"error": "No images provided"}

        # --- STAGE 1: CLIP SCREENING ---
        # Look at first 3 images for a quick verdict
        screen_images = image_paths[:3]
        clip_results = await self.clip.classify_images(screen_images)
        
        is_supermarket = any(r['label'] == 'supermarket' and r['score'] > 0.4 for r in clip_results)
        has_cooler = any(r['label'] == 'cooler_detected' and r['score'] > 0.3 for r in clip_results)
        is_unidentifiable = all(r['label'] in ['unidentifiable', 'non-commercial'] or r['score'] < 0.2 for r in clip_results)

        if is_unidentifiable and len(image_paths) < 1: # Basic check
             return {
                "contains_fridge": False,
                "outlet_type": "uncertain",
                "store_category": "N/A",
                "asset_count": 0,
                "appliance_types": "N/A",
                "asset_breakdown": "None",
                "confidence": "low",
                "reason": "Images are unavailable, blurry or non-commercial.",
                "verification_notes": "CLIP screening found no identifiable commercial outlet or assets."
            }

        # --- STAGE 2: GEMINI ANALYSIS (Only if CLIP suggests interest or for full validation) ---
        # Even if not a supermarket, we might need Gemini to count fridges in a kirana
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
