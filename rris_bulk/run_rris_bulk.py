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
    "start_time": 0
}

def print_banner():
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.CYAN}  RRIS INDUSTRY BULK ANALYSIS WORKER v2.0")
    print(f"{Fore.CYAN}{'='*60}\n")

def print_step(step_num, message):
    print(f"{Fore.YELLOW}[Step {step_num}]{Style.RESET_ALL} {message}")

async def process_store(row, image_dir, engine, semaphore, pbar):
    store_id = str(row['store_id'])
    store_url = row['store_url']
    store_location = row['store_location']
    
    store_folder = os.path.join(image_dir, store_id)
    
    result_base = {
        "store_id": store_id,
        "store_url": store_url,
        "store_location": store_location,
        "fridge_detected": "INSUFFICIENT_DATA",
        "appliance_type": "N/A",
        "cov_stage": "N/A",
        "confidence_level": "N/A",
        "confidence_score": 0.0,
        "images_scanned": 0,
        "reasoning": "Folder missing or empty",
        "analysis_timestamp": datetime.now().isoformat()
    }

    if not os.path.exists(store_folder):
        stats["insufficient"] += 1
        pbar.update(1)
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"])
        return result_base

    image_files = [os.path.join(store_folder, f) for f in os.listdir(store_folder) 
                   if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    
    if not image_files:
        stats["insufficient"] += 1
        pbar.update(1)
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"])
        return result_base

    result_base["images_scanned"] = len(image_files)

    async with semaphore:
        try:
            analysis = await engine.analyze_store(image_files)
            
            if "error" in analysis:
                stats["errors"] += 1
                result_base["fridge_detected"] = "ERROR"
                result_base["reasoning"] = f"Gemini Error: {analysis['error']}"
            else:
                stats["success"] += 1
                result_base.update({
                    "fridge_detected": "YES" if analysis.get("contains_fridge") else "NO",
                    "appliance_type": analysis.get("outlet_type", "N/A"),
                    "cov_stage": analysis.get("detection_method", "N/A"),
                    "confidence_level": analysis.get("confidence", "N/A"),
                    "confidence_score": 0.9 if analysis.get("confidence") == "high" else (0.6 if analysis.get("confidence") == "medium" else 0.3),
                    "reasoning": (analysis.get("reason", "N/A") + " | " + analysis.get("verification_notes", "")).strip(" | "),
                })
        except Exception as e:
            stats["errors"] += 1
            result_base["fridge_detected"] = "ERROR"
            result_base["reasoning"] = f"Runtime Error: {str(e)}"
        
        pbar.update(1)
        # Update progress bar with live stats
        elapsed = time.time() - stats["start_time"]
        processed = stats["success"] + stats["errors"] + stats["insufficient"]
        if processed > 0:
            avg_time = elapsed / processed
            rem_stores = stats["total"] - processed
            eta_seconds = avg_time * rem_stores
            eta_str = str(timedelta(seconds=int(eta_seconds)))
            pbar.set_description(f"Processing (ETA: {eta_str})")
        
        pbar.set_postfix(succ=stats["success"], err=stats["errors"], skip=stats["insufficient"])
        return result_base

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
    print_step(6, "Finalizing and Exporting Data...")
    output_path = os.path.join(output_dir, f"rris_bulk_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    results_df = pd.DataFrame(results)
    results_df.to_csv(output_path, index=False)

    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.GREEN}  MISSION SUCCESS: Analysis Complete!")
    print(f"{Fore.CYAN}{'='*60}")
    print(f"  {Fore.WHITE}Total Stores:       {stats['total']}")
    print(f"  {Fore.GREEN}Success Detections: {stats['success']}")
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
