import os
import json
import requests
import io
from PIL import Image
import google.generativeai as genai
from dotenv import load_dotenv
import re

load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

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

def run_cov_audit(image_urls):
    """
    Implements the two-stage CoV audit workflow.
    Stage 1: Outlet Type Classification
    Stage 2: Cooling Device Detection (if needed)
    """
    print(f"[Vision Engine] Starting CoV Audit on {len(image_urls)} images...")
    
    # 1. Prepare images for Gemini
    parts = [SYSTEM_PROMPT]
    for i, url in enumerate(image_urls[:10]): # Limit to first 10 for context window safety
        try:
            img = get_image_from_url(url)
            parts.append(img)
            parts.append(f"[This is image_{i+1}]")
        except Exception as e:
            print(f"[Vision Engine] Error loading image {url}: {e}")
            continue
            
    parts.append("Now analyze these outlet images and return the JSON result.")
    
    # 2. Generate Content
    try:
        response = model.generate_content(
            parts,
            generation_config={
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        )
        
        # 3. Clean and parse JSON
        text = response.text
        # Ensure we only have the JSON object
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            print(f"[Vision Engine] No JSON found in response: {text}")
            return {"error": "Invalid engine response"}
            
    except Exception as e:
        print(f"[Vision Engine] Critical Error in run_cov_audit: {e}")
        return {"error": str(e)}

# Keep the old localization/auditing functions for potential fallback or secondary analysis
# (Already defined above in the file)
