import asyncio
import json
import os
from dotenv import load_dotenv
from scraper import scrape_google_maps_photos
from vision_engine import run_cov_audit

load_dotenv(".env.local") if os.path.exists(".env.local") else load_dotenv()

async def run_audit(maps_url=None, place_id=None):
    print(f"[Audit] Starting Advanced CoV Audit for: {maps_url or place_id}")
    
    # Step 1: Scrape Photos and Details
    try:
        photo_urls, details = await scrape_google_maps_photos(maps_url=maps_url, place_id=place_id, max_photos=10)
        if not photo_urls and not details:
            raise RuntimeError("Scraper returned no data. Verify the Google Maps URL or Place ID.")
        print(f"[Scraper] Found {len(photo_urls)} high-res photos for {details.get('name', 'N/A')}.")
    except Exception as e:
        print(f"[Scraper] Error: {e}")
        raise RuntimeError(f"Audit failed during image extraction: {str(e)}")

    # Step 2: Run Two-Stage CoV Audit
    try:
        # If no photos, we can't do vision audit, but details might still be useful
        if not photo_urls:
            report_output = {
                "contains_fridge": False,
                "detection_method": "no_images",
                "outlet_type": "uncertain",
                "reason": "No images available for analysis.",
                "confidence": "low",
                "verification_notes": "Scraper found 0 images."
            }
        else:
            report_output = run_cov_audit(photo_urls)
            
        report_output["store_maps_url"] = maps_url
        report_output["place_id"] = place_id or details.get("place_id")
        report_output["total_images_scraped"] = len(photo_urls)
        report_output["place_details"] = details
        
        if "error" in report_output:
            raise RuntimeError(f"Vision Engine reported error: {report_output['error']}")

        print(f"\n--- CoV Audit Result ---")
        print(f"Outlet Name: {details.get('name')}")
        print(f"Outlet Type: {report_output.get('outlet_type')}")
        print(f"Contains Fridge: {report_output.get('contains_fridge')}")

        try:
            with open("audit_report.json", "w", encoding="utf-8") as f:
                json.dump(report_output, f, indent=4)
        except:
            pass
            
        return report_output

    except Exception as e:
        print(f"[Vision Engine] Execution Error: {e}")
        raise RuntimeError(f"Audit failed during AI analysis: {str(e)}")

    # Step 4: Export to Google Sheets (Optional)
    try:
        from google_sheets import export_to_sheets
        export_to_sheets("audit_report.json", "RRIS_Production_Audit_Log")
    except Exception as e:
        print(f"[Sheets] Export skipped/failed: {e}")

if __name__ == "__main__":
    import sys
    url = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        url = sys.argv[1]
        
    asyncio.run(run_audit(url))
