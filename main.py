import asyncio
import json
import os
from scraper import scrape_google_maps_photos
from vision_engine import process_full_audit

async def run_audit(maps_url):
    print(f"🚀 Starting High-Accuracy Audit for: {maps_url}")
    
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

    # Step 2: Audit each photo
    full_audit_results = []
    for i, url in enumerate(photo_urls):
        print(f"\n--- Analyzing Photo {i+1}/{len(photo_urls)} ---")
        try:
            report = process_full_audit(url)
            
            # Enrich report with source URL for each asset
            enriched_detections = []
            for item in report:
                item["source_image_url"] = url
                enriched_detections.append(item)
            
            if not enriched_detections:
                print(f"✨ Image {i+1} is 'Clean' (No FMCG assets detected).")
            else:
                print(f"🔍 Detected {len(enriched_detections)} assets in Image {i+1}.")

            full_audit_results.append({
                "image_url": url,
                "status": "Clean" if not enriched_detections else "Analyzed",
                "detections": enriched_detections
            })
        except Exception as e:
            print(f"❌ Vision Engine Error on image {i+1}: {e}")

    # Step 3: Consolidate Report
    report_output = {
        "store_maps_url": maps_url,
        "total_images_analyzed": len(photo_urls),
        "audit_data": full_audit_results
    }

    # Save to JSON
    json_path = "audit_report.json"
    with open(json_path, "w") as f:
        json.dump(report_output, f, indent=4)
        
    print(f"\n✅ Audit Complete! Results saved to {json_path}")

    # Step 4: Export to Google Sheets (Optional)
    from google_sheets import export_to_sheets
    export_to_sheets(json_path, "RRIS_Production_Audit_Log")

if __name__ == "__main__":
    import sys
    url = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        url = sys.argv[1]
        
    asyncio.run(run_audit(url))
