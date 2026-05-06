import os
import json
import requests
import io
from PIL import Image
import google.generativeai as genai
import os
from dotenv import load_dotenv
import re

load_dotenv(".env.local") if os.path.exists(".env.local") else load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-flash-latest')

# Hugging Face CLIP Configuration
CLIP_API_URL = "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32"
VISION_MODEL_API_KEY = os.getenv("VISION_MODEL_API_KEY")

CLIP_OFFLINE_LABELS = [
    "a photo of a supermarket or hypermarket with many aisles",
    "a photo of a small kirana store or traditional retail shop",
    "a photo of a clear refrigeration cooling device (fridge/freezer)",
    "a photo that is blurry, dark, or unidentifiable"
]

CLIP_LABEL_MAP = {
    "a photo of a supermarket or hypermarket with many aisles": "supermarket",
    "a photo of a small kirana store or traditional retail shop": "kirana",
    "a photo of a clear refrigeration cooling device (fridge/freezer)": "cooler",
    "a photo that is blurry, dark, or unidentifiable": "unidentifiable"
}

import base64

async def classify_with_clip(image_pil):
    """
    Zero-shot classification via HF Inference API.
    """
    if not VISION_MODEL_API_KEY:
        return None
        
    try:
        # Convert PIL to base64
        buffered = io.BytesIO()
        image_pil.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        payload = {
            "inputs": img_str,
            "parameters": {"candidate_labels": CLIP_OFFLINE_LABELS}
        }
        
        headers = {"Authorization": f"Bearer {VISION_MODEL_API_KEY}"}
        
        # Async-friendly request
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(CLIP_API_URL, headers=headers, json=payload) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        top = data[0]
                        return {
                            "label": CLIP_LABEL_MAP.get(top["label"], "uncertain"),
                            "score": top["score"]
                        }
    except Exception as e:
        print(f"[CLIP] Error: {e}")
    return None

def get_image_from_url(url):
    """Fetches an image from URL and returns a PIL Image object."""
    try:
        response = requests.get(url, stream=True, timeout=10)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content))
    except Exception as e:
        print(f"[Vision Engine] Image fetch failed for {url}: {e}")
        raise

from prompts import SYSTEM_PROMPT

async def run_cov_audit(image_urls=None, pil_images=None):
    """
    Implements the two-stage CoV audit workflow with CLIP-first screening.
    """
    print(f"[Vision Engine] Starting CoV Audit...")
    
    loaded_images = []
    if pil_images:
        loaded_images = pil_images[:10]
    elif image_urls:
        for url in image_urls[:10]:
            try:
                loaded_images.append(get_image_from_url(url))
            except: continue

    if not loaded_images:
        return {"error": "No images available for analysis"}

    # --- STAGE 1: CLIP SCREENING ---
    # Screen first 3 images
    clip_hits = []
    for img in loaded_images[:3]:
        res = await classify_with_clip(img)
        if res: clip_hits.append(res)
    
    is_supermarket = any(h['label'] == 'supermarket' and h['score'] > 0.4 for h in clip_hits)
    has_cooler = any(h['label'] == 'cooler' and h['score'] > 0.35 for h in clip_hits)
    
    # If it's highly likely to be non-commercial/unidentifiable, skip Gemini
    if not is_supermarket and not has_cooler and len(clip_hits) > 0:
        # Check if they are all very confident it's kirana/non-commercial without a cooler
        if all(h['label'] in ['kirana', 'non-commercial', 'unidentifiable'] for h in clip_hits):
             return {
                "contains_fridge": False,
                "detection_method": "clip_screening",
                "outlet_type": clip_hits[0]['label'] if clip_hits else "kirana / small retail",
                "reason": "CLIP pre-screening found no evidence of cooling devices or large-scale retail format.",
                "confidence": "medium",
                "verification_notes": f"CLIP matched: {', '.join([h['label'] for h in clip_hits])}. Analysis shortcut triggered to save credits."
            }

    # Prepare Gemini call
    parts = [SYSTEM_PROMPT]
    for i, img in enumerate(loaded_images):
        parts.append(img)
        parts.append(f"[This is image_{i+1}]")

    parts.append("Now analyze these outlet images and return the JSON result.")
    
    # 2. Generate Content
    try:
        response = model.generate_content(
            parts,
            generation_config={
                "temperature": 0.1
            }
        )
        
        # Deep inspection for troubleshooting
        if not response:
            print("[Vision Engine] Error: Received empty response object from Gemini.")
            return {"error": "Empty AI response"}
            
        if not response.candidates:
             print(f"[Vision Engine] Error: No candidates in response. Metadata: {response.prompt_feedback}")
             return {"error": "No candidates generated (possible safety block)"}

        # 3. Clean and parse JSON
        try:
            text = response.text
        except ValueError as ve:
            # This happens if the response was blocked by safety filters
            print(f"[Vision Engine] Error accessing text (safety filter?): {ve}")
            return {"error": f"Response blocked by safety: {str(ve)}"}

        if not text:
            print("[Vision Engine] Error: response.text is empty.")
            return {"error": "AI returned empty text"}

        # Ensure we only have the JSON object
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError as jde:
                print(f"[Vision Engine] JSON Decode Error: {jde}. Raw match: {json_match.group()}")
                return {"error": f"JSON parse error: {str(jde)}"}
        else:
            print(f"[Vision Engine] No JSON found in response. Raw text snippet: {text[:200]}")
            return {"error": "Incompatible engine response format"}
            
    except Exception as e:
        print(f"[Vision Engine] Critical Error in run_cov_audit: {e}")
        return {"error": str(e)}

# Keep the old localization/auditing functions for potential fallback or secondary analysis
# (Already defined above in the file)
