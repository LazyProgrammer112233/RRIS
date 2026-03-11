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
