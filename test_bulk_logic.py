import os
import sys
import pandas as pd

# Add rris_bulk to path
sys.path.append(os.path.join(os.getcwd(), "rris_bulk"))

from csv_validator import validate_csv
from rris_engine import RRISEngine

def test_csv_validation():
    print("Testing CSV Validation...")
    # Create a mock CSV
    test_csv = "/tmp/test_stores.csv"
    df = pd.DataFrame({
        "store_id": ["1001", "1002"],
        "store_url": ["http://maps.google.com/1", "http://maps.google.com/2"],
        "store_location": ["NY", "LA"]
    })
    df.to_csv(test_csv, index=False)
    
    success, result = validate_csv(test_csv)
    if success:
        print("[PASS] Valid CSV detected correctly.")
    else:
        print(f"[FAIL] Valid CSV rejected: {result}")

    # Create an invalid CSV
    invalid_csv = "/tmp/invalid_stores.csv"
    df_invalid = pd.DataFrame({
        "id": ["1001"],
        "url": ["link"]
    })
    df_invalid.to_csv(invalid_csv, index=False)
    success, result = validate_csv(invalid_csv)
    if not success:
        print("[PASS] Invalid CSV rejected correctly.")
    else:
        print("[FAIL] Invalid CSV accepted.")

def test_engine_init():
    print("\nTesting Engine Initialization...")
    try:
        engine = RRISEngine("MOCK_KEY")
        print("[PASS] Engine initialized.")
    except Exception as e:
        print(f"[FAIL] Engine init failed: {e}")

if __name__ == "__main__":
    if not os.path.exists("/tmp"):
        os.makedirs("/tmp")
    test_csv_validation()
    test_engine_init()
