import asyncio
import json
import os
from scraper import scrape_google_maps_photos
from vision_engine import run_cov_audit

async def run_audit(maps_url):
    print(f"🚀 Starting Advanced CoV Audit for: {maps_url}")
    
    # Step 1: Scrape Photo URLs
    try:
        photo_urls = await scrape_google_maps_photos(maps_url, max_photos=5)
        if not photo_urls:
            print("❌ No photo URLs extracted.")
            return
        print(f"📸 Found {len(photo_urls)} high-res photos.")
    except Exception as e:
        print(f"❌ Scraper Error: {e}")
        return

    # Step 2: Run Two-Stage CoV Audit
    try:
        report_output = run_cov_audit(photo_urls)
        report_output["store_maps_url"] = maps_url
        report_output["total_images_scraped"] = len(photo_urls)
        
        if "error" in report_output:
            print(f"❌ Vision Engine Error: {report_output['error']}")
            return

        print(f"\n--- CoV Audit Result ---")
        print(f"Outlet Type: {report_output.get('outlet_type')}")
        print(f"Contains Fridge: {report_output.get('contains_fridge')}")
        print(f"Method: {report_output.get('detection_method')}")
        print(f"Confidence: {report_output.get('confidence')}")

    except Exception as e:
        print(f"❌ Vision Engine Execution Error: {e}")
        return

    # Step 3: Save to JSON
    json_path = "audit_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_output, f, indent=4)
        
    print(f"\n✅ Audit Complete! Results saved to {json_path}")

    # Step 4: Export to Google Sheets (Optional)
    try:
        from google_sheets import export_to_sheets
        export_to_sheets(json_path, "RRIS_Production_Audit_Log")
    except Exception as e:
        print(f"⚠️ Sheets Export skipped/failed: {e}")

if __name__ == "__main__":
    import sys
    url = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        url = sys.argv[1]
        
    asyncio.run(run_audit(url))
