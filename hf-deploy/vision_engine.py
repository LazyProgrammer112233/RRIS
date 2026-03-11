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
model = genai.GenerativeModel('gemini-1.5-flash')

def get_image_from_url(url):
    """Fetches an image from URL and returns a PIL Image object."""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content))

def stage_1_localization(image_url):
    """
    Stage 1: Identify bounding boxes for assets.
    Returns: List of detected objects with bounding boxes.
    """
    system_prompt = """
    You are an expert Retail Auditor. Analyze this retail environment. 
    Identify every instance of cooling equipment (Visi Coolers, Chest Freezers) and branded display racks.

    NEGATIVE CONSTRAINTS (IGNORE THESE):
    - Domestic/Household Refrigerators (usually smaller, non-glass doors, found in kitchens).
    - Walk-in Cold Storage Rooms (unless it has a retail display glass door).
    - Generic storage shelves that are NOT branded display racks.

    Output Format: Return EXACTLY a JSON list of objects: 
    [{"asset_type": "string", "box_2d": [ymin, xmin, ymax, xmax], "confidence": float}]
    
    Constraint: Do not classify the brand yet. Focus only on accurate bounding boxes.
    Coordinates should be normalized 0-1000.
    """
    
    img = get_image_from_url(image_url)
    
    response = model.generate_content([system_prompt, img])
    
    # Extract JSON from response
    try:
        text = response.text
        # Cleanup markdown backticks if present
        json_str = re.search(r'\[.*\]', text, re.DOTALL).group()
        detections = json.loads(json_str)
        return detections, img
    except Exception as e:
        print(f"[Vision Engine] Stage 1 JSON Parsing Error or No Assets: {e}")
        return [], img

def stage_2_auditing(crop_img, asset_type):
    """
    Stage 2: Detailed audit of a cropped asset.
    Uses Chain-of-Thought (CoT) prompting with Logo OCR.
    """
    system_prompt = f"""
    Analyze this cropped image of a retail asset identifying as {asset_type}.
    Use the following definitions:
    - Visi Cooler: Vertical unit, transparent glass door, internal shelves, used for chilled beverages.
    - Chest Freezer: Horizontal unit, sliding glass or solid lid, used for frozen goods/ice cream.
    - Branded Rack: Non-electrical display stands with prominent brand headers.

    Chain-of-Thought (CoT) Requirement:
    1. Identify the primary brand logo visible (e.g., Coca-Cola, Pepsi, Amul).
    2. Logo OCR: If the brand identity is ambiguous, attempt to read any printed text on the asset chassis, 
       headers, or glass stickers (e.g., 'Amul', 'Kwality Wall's', 'Mother Dairy') to confirm the brand.
    3. Determine if the unit is 'Pure' (only one brand) or 'Mixed' (multiple brands inside).
    4. Assess the 'Stock Level' (Empty, Partially Stocked, Full).

    Final Output Format (JSON):
    {{
        "asset_classification": "string",
        "brand_logo": "string",
        "purity": "Pure" | "Mixed",
        "stock_level": "Empty" | "Partially Stocked" | "Full",
        "confirmed_via_ocr": boolean,
        "reasoning": "string"
    }}
    """
    
    response = model.generate_content([system_prompt, crop_img])
    
    try:
        text = response.text
        json_str = re.search(r'\{.*\}', text, re.DOTALL).group()
        audit_result = json.loads(json_str)
        return audit_result
    except Exception as e:
        print(f"[Vision Engine] Stage 2 JSON Parsing Error: {e}")
        return {"error": "Could not audit asset"}

from validator import validate_detection

def hyper_focus_audit(crop_img, prev_audit):
    """
    Stage 3: Re-audit with 'Hyper-Focus' on discrepancies.
    Called when validator finds a mismatch or low confidence.
    """
    focus_prompt = f"""
    HYPER-FOCUS AUDIT REQUIRED. 
    Previous analysis suggested: {prev_audit.get('brand_logo')} / {prev_audit.get('asset_classification')}.
    
    A validation layer flagged this for potential error/hallucination.
    Please re-examine this image with 100% focus on precision:
    1. Is this DEFINITELY a retail cooling unit or rack?
    2. Check the logo again. Read any and all text tags.
    3. If it looks like a household fridge, flag it as 'INVALID_ASSET'.
    
    Return the final corrected JSON.
    """
    
    response = model.generate_content([focus_prompt, crop_img])
    try:
        text = response.text
        json_str = re.search(r'\{.*\}', text, re.DOTALL).group()
        return json.loads(json_str)
    except:
        return prev_audit

def process_full_audit(image_url):
    """
    Full pipeline: Stage 1 -> Crop -> Stage 2 -> Validation -> (Optional) Hyper-Focus
    """
    print(f"[Vision Engine] Starting deep audit for: {image_url}")
    detections, original_img = stage_1_localization(image_url)
    
    width, height = original_img.size
    final_report = []
    
    for i, det in enumerate(detections):
        box = det['box_2d']
        
        # Convert normalized to pixel coordinates
        left = max(0, box[1] * width / 1000)
        top = max(0, box[0] * height / 1000)
        right = min(width, box[3] * width / 1000)
        bottom = min(height, box[2] * height / 1000)
        
        # Ensure box is valid
        if right <= left or bottom <= top:
            continue
            
        # Crop
        crop = original_img.crop((left, top, right, bottom))
        
        # 1. Stage 2 Audit
        audit = stage_2_auditing(crop, det['asset_type'])
        
        # 2. Automated QA Validation
        validation = validate_detection(crop, audit)
        
        final_audit = audit
        if not validation.get("is_valid") or validation.get("confidence_score", 0) < 0.85:
            print(f"  ⚠️ Low confidence ({validation.get('confidence_score')}) or Invalid detected. Triggering Hyper-Focus...")
            # 3. Self-Correction (Stage 3)
            final_audit = hyper_focus_audit(crop, audit)
            final_audit["self_corrected"] = True
        
        # Final filtering for hallucinations flagged as INVALID
        if final_audit.get("asset_classification") == "INVALID_ASSET" or validation.get("is_hallucination"):
            print(f"  🚫 Hallucination filtered out.")
            continue

        final_report.append({
            "localization": det,
            "audit": final_audit,
            "validation": validation
        })
        
    return final_report

    # Example usage
    pass
