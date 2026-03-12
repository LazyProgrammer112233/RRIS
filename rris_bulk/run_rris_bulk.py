import os
import asyncio
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from datetime import datetime, timedelta
import time
from rris_engine import RRISEngine
from csv_validator import validate_csv
import yaml
from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)

# Load config
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.yaml")
with open(CONFIG_FILE, 'r') as f:
    config = yaml.safe_load(f)

# Global stats for live reporting
stats = {
    "total": 0,
    "processed": 0,
    "success": 0,
    "insufficient": 0,
    "errors": 0,
    "skipped": 0,
    "start_time": 0
}

# Session-based cache for place_id redundancy check
processed_place_ids = set()

def print_banner():
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.CYAN}  RRIS INDUSTRY BULK ANALYSIS WORKER v2.0")
    print(f"{Fore.CYAN}{'='*60}\n")

def print_step(step_num, message):
    print(f"{Fore.YELLOW}[Step {step_num}]{Style.RESET_ALL} {message}")

async def process_store(row, image_dir, engine, semaphore, pbar):
    # Robust Folder Detection
    place_id = str(row.get('place_id', ''))
    store_id_val = str(row.get('store_id', ''))
    
    # Priority 1: place_id folder
    # Priority 2: store_id folder
    store_folder = None
    search_dirs = []
    
    if place_id:
        p_folder = os.path.join(image_dir, place_id)
        search_dirs.append(place_id)
        if os.path.exists(p_folder):
            store_folder = p_folder
            
    if not store_folder and store_id_val:
        s_folder = os.path.join(image_dir, store_id_val)
        search_dirs.append(store_id_val)
        if os.path.exists(s_folder):
            store_folder = s_folder
    
    # Unique identifier for redundancy check (prefer place_id)
    unique_id = place_id if place_id else store_id_val
    
    # Redundancy Check
    if unique_id in processed_place_ids:
        stats["skipped"] += 1
        pbar.update(1)
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"], dup=stats["skipped"])
        return None # Signal to skip

    processed_place_ids.add(unique_id)
    
    # Initialize result with original row data to maintain "Master Analysis" integrity
    result = row.to_dict()
    
    # New Standard Columns
    result.update({
        "cd_detected": "INSUFFICIENT_DATA",
        "appliance_type": "N/A",
        "store_category": "N/A",
        "Count of Assets Detected": 0,
        "Category of Asset Detected": "N/A",
        "Number of Photos Analysed": 0,
        "Outlet Category as Identified": "N/A",
        "Analysis Status": "INSUFFICIENT_DATA",
        "Verification Notes": f"Folder missing or empty. Looked for: {', '.join(search_dirs)}"
    })

    if not store_folder:
        stats["insufficient"] += 1
        pbar.update(1)
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"], dup=stats["skipped"])
        return result

    image_files = [os.path.join(store_folder, f) for f in os.listdir(store_folder) 
                   if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    
    if not image_files:
        stats["insufficient"] += 1
        pbar.update(1)
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"], dup=stats["skipped"])
        return result

    result["Number of Photos Analysed"] = len(image_files)

    async with semaphore:
        try:
            analysis = await engine.analyze_store(image_files)
            
            if "error" in analysis:
                stats["errors"] += 1
                result["Analysis Status"] = "ERROR"
                result["Verification Notes"] = f"Gemini Error: {analysis['error']}"
            else:
                stats["success"] += 1
                result.update({
                    "Analysis Status": "SUCCESS",
                    "cd_detected": "YES" if analysis.get("contains_fridge") else "NO",
                    "appliance_type": analysis.get("appliance_types", "None"),
                    "store_category": analysis.get("store_category", "N/A"),
                    "Count of Assets Detected": analysis.get("asset_count", 0),
                    "Category of Asset Detected": analysis.get("asset_breakdown", "None"),
                    "Outlet Category as Identified": analysis.get("outlet_type", "N/A"),
                    "Verification Notes": (analysis.get("reason", "") + " | " + analysis.get("verification_notes", "")).strip(" | "),
                    "Confidence": analysis.get("confidence", "N/A")
                })
        except Exception as e:
            stats["errors"] += 1
            result["Analysis Status"] = "ERROR"
            result["Verification Notes"] = f"Runtime Error: {str(e)}"
        
        pbar.update(1)
        # Update progress bar with live stats
        elapsed = time.time() - stats["start_time"]
        processed = stats["success"] + stats["errors"] + stats["insufficient"] + stats["skipped"]
        if processed > 0:
            avg_time = elapsed / processed
            rem_stores = stats["total"] - processed
            eta_seconds = avg_time * rem_stores
            eta_str = str(timedelta(seconds=int(eta_seconds)))
            pbar.set_description(f"Processing (ETA: {eta_str})")
        
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"], dup=stats["skipped"])
        return result

async def main():
    print_banner()

    # Step 1: Authentication
    print_step(1, "Authenticating Gemini AI...")
    
    # Use absolute path for .env relative to script
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    load_dotenv(env_path)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print(f"{Fore.MAGENTA}No API Key found in .env{Style.RESET_ALL}")
        api_key = input("  > Enter your Gemini API Key: ").strip()
        try:
            with open(env_path, "a") as f:
                f.write(f"\nGEMINI_API_KEY={api_key}\n")
            print(f"{Fore.GREEN}  [✓] Session Authenticated and key saved to .env{Style.RESET_ALL}")
        except Exception as e:
            print(f"{Fore.YELLOW}  [!] Key authenticated for this session, but could not save to .env: {e}{Style.RESET_ALL}")
    else:
        print(f"{Fore.GREEN}  [✓] System Authenticated via .env{Style.RESET_ALL}")

    # Step 2: Data Configuration
    print_step(2, "Configuring Data Sources...")
    csv_path = input("  > Path to CSV Dataset: ").strip().strip('"')
    image_dir = input("  > Path to Image Directory: ").strip().strip('"')
    output_dir = input("  > Path for Results: ").strip().strip('"')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"  [i] Created output directory: {output_dir}")

    # Step 3: Dataset Validation
    print_step(3, "Validating CSV Structure...")
    success, df_or_error = validate_csv(csv_path)
    if not success:
        print(f"\n{Fore.RED}[CRITICAL ERROR] UI-BASED VALIDATION FAILED:")
        print(f"{Fore.RED}Details: {df_or_error}")
        print(f"{Fore.YELLOW}Expected Columns: store_id, store_url, store_location")
        input("\nPress Enter to exit...")
        return
    
    df = df_or_error
    stats["total"] = len(df)
    print(f"{Fore.GREEN}  [✓] dataset verified. {stats['total']} stores queued for analysis.{Style.RESET_ALL}")

    # Step 4: Initialization
    print_step(4, "Initializing AI Core & Concurrency...")
    engine = RRISEngine(api_key)
    max_concurrency = config.get('max_concurrent_requests', 15)
    semaphore = asyncio.Semaphore(max_concurrency)
    print(f"  [i] Target Concurrency: {max_concurrency} parallel streams.")

    # Step 5: Execution
    print_step(5, f"Starting Analysis Loop for {stats['total']} entries...")
    stats["start_time"] = time.time()
    
    tasks = []
    # Create progress bar
    with tqdm(total=stats["total"], unit="store", dynamic_ncols=True, 
              bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}{postfix}]') as pbar:
        
        for _, row in df.iterrows():
            tasks.append(process_store(row, image_dir, engine, semaphore, pbar))

        results = await asyncio.gather(*tasks)

    # Step 6: Finalization
    print_step(6, "Finalizing Master Analysis CSV...")
    # Filter out None results from skipped stores
    valid_results = [r for r in results if r is not None]
    
    output_path = os.path.join(output_dir, f"RRIS_Master_Analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    results_df = pd.DataFrame(valid_results)
    
    # Ensure specific column order for delivery
    standard_cols = [
        "place_id", "store_id", "store_url", "store_location", 
        "cd_detected", "appliance_type", "store_category",
        "Count of Assets Detected", "Category of Asset Detected", 
        "Number of Photos Analysed", "Outlet Category as Identified",
        "Analysis Status", "Confidence", "Verification Notes"
    ]
    
    # Include any other original columns that might be present
    all_cols = list(results_df.columns)
    ordered_cols = [c for c in standard_cols if c in all_cols] + [c for c in all_cols if c not in standard_cols]
    
    results_df[ordered_cols].to_csv(output_path, index=False)

    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.GREEN}  MISSION SUCCESS: Analysis Complete!")
    print(f"{Fore.CYAN}{'='*60}")
    print(f"  {Fore.WHITE}Total Stores Queued: {stats['total']}")
    print(f"  {Fore.GREEN}Success Detections: {stats['success']}")
    print(f"  {Fore.BLUE}Skipped (Redundant): {stats['skipped']}")
    print(f"  {Fore.YELLOW}Insufficient Data:  {stats['insufficient']}")
    print(f"  {Fore.RED}System Errors:      {stats['errors']}")
    print(f"  {Fore.WHITE}Output Location:    {output_path}")
    print(f"{Fore.CYAN}{'='*60}\n")
    
    input("Press Enter to close worker...")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.RED}[!] Process interrupted by user. Exiting...")
    except Exception as e:
        print(f"\n{Fore.RED}[!] CRITICAL SYSTEM BUG DETECTED:")
        print(f"{Fore.RED}Trace: {str(e)}")
        input("\nPress Enter to exit...")
