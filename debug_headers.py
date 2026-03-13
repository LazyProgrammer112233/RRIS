import pandas as pd
import os
import asyncio
import sys
from datetime import datetime

# Add rris_bulk to path
sys.path.append(os.path.join(os.getcwd(), 'rris_bulk'))

# We need a mock engine that returns a dict
class MockEngine:
    async def analyze_store(self, imgs):
        return {
            "contains_fridge": True,
            "outlet_type": "modern trade store",
            "store_category": "supermarket",
            "asset_count": 5,
            "appliance_types": "visi cooler, chest freezer",
            "asset_breakdown": "3 Visi Coolers, 2 Chest Freezers",
            "confidence": "high",
            "reason": "Test",
            "verification_notes": "None"
        }

async def dummy_run():
    import run_rris_bulk
    
    # Mock data
    row = pd.Series({
        "place_id": "test_id",
        "store_id": "test_store",
        "store_url": "url",
        "store_location": "loc"
    })
    
    # Mock image folder
    os.makedirs("rris_images/test_id", exist_ok=True)
    with open("rris_images/test_id/test.jpg", "w") as f:
        f.write("test")
        
    engine = MockEngine()
    semaphore = asyncio.Semaphore(1)
    pbar = type('MockPbar', (), {'update': lambda x, y: None, 'set_postfix': lambda x, **kwargs: None, 'set_description': lambda x, y: None})()
    
    # In run_rris_bulk, pbar is tqdm, our mock needs to handle description etc.
    # Actually, pbar in process_store is tqdm object.
    
    # Let's mock the process_store call
    result = await run_rris_bulk.process_store(row, "rris_images", engine, semaphore, pbar)
    
    print("Result Keys:", list(result.keys()))
    
    # Test CSV export logic
    results_df = pd.DataFrame([result])
    output_path = "DEBUG_Master_Analysis.csv"
    
    standard_cols = [
        "place_id", "store_id", "store_url", "store_location", 
        "cd_detected", "appliance_type", "store_category",
        "Count of Assets Detected", "Category of Asset Detected", 
        "Number of Photos Analysed", "Outlet Category as Identified",
        "Analysis Status", "Confidence", "Verification Notes"
    ]
    all_cols = list(results_df.columns)
    ordered_cols = [c for c in standard_cols if c in all_cols] + [c for c in all_cols if c not in standard_cols]
    
    results_df[ordered_cols].to_csv(output_path, index=False)
    
    print("Generated CSV Headers:")
    print(pd.read_csv(output_path).columns.tolist())
    
    # Cleanup
    os.remove(output_path)
    shutil.rmtree("rris_images", ignore_errors=True)

if __name__ == "__main__":
    import shutil
    asyncio.run(dummy_run())
