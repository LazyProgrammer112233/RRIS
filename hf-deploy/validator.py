import os
import json
import re
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash')

def validate_detection(crop_img, audit_data):
    """
    Performs a high-reasoning sanity check on a specific detection.
    Detects hallucinations and brand identity mismatches.
    """
    validation_prompt = f"""
    You are a Senior Quality Auditor for Retail AI. Verify this detection.
    
    Original Detection Data:
    - Asset Type: {audit_data.get('asset_classification')}
    - Brand Logo: {audit_data.get('brand_logo')}
    - Purity: {audit_data.get('purity')}
    - Confirmed via OCR: {audit_data.get('confirmed_via_ocr')}
    
    Validation Task:
    1. Sanity Check: Is there ANY chance this is a hallucination? (e.g., is it just a shelf, a wall, or a human instead of a retail cooler/rack?)
    2. Brand Consistency: Does the Brand Logo ({audit_data.get('brand_logo')}) match the typical brand colors and shape visible in the image?
    3. Negative Constraint Check: Is this a domestic/household fridge instead of a commercial retail unit?

    Return EXACTLY a JSON response:
    {{
        "is_valid": boolean,
        "is_hallucination": boolean,
        "brand_mismatch": boolean,
        "confidence_score": float (0-1),
        "audit_note": "string"
    }}
    """
    
    try:
        response = model.generate_content([validation_prompt, crop_img])
        text = response.text
        json_str = re.search(r'\{.*\}', text, re.DOTALL).group()
        validation_result = json.loads(json_str)
        return validation_result
    except Exception as e:
        print(f"[Validator] Error validating asset: {e}")
        return {"is_valid": False, "confidence_score": 0, "error": str(e)}

def run_qa_loop(report_path):
    """
    Reads the audit report and validates each detection.
    Returns a list of assets that need 'Hyper-Focus' re-runs.
    """
    if not os.path.exists(report_path):
        return []
        
    with open(report_path, "r") as f:
        report = json.load(f)
        
    correction_queue = []
    
    # Needs a way to access the cropped images. 
    # For now, we assume we can re-fetch and re-crop or the vision_engine can be called again.
    # In a real production loop, we might pass the PIL images in memory.
    
    return correction_queue
