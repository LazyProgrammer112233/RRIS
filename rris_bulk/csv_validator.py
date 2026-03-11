import pandas as pd
import os

def validate_csv(csv_path):
    """
    Validates that the CSV contains the required columns.
    Expected schema: store_id, store_url, store_location
    """
    if not os.path.exists(csv_path):
        return False, f"Error: File not found at {csv_path}"
    
    try:
        df = pd.read_csv(csv_path)
        required_columns = ['store_id', 'store_url', 'store_location']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return False, f"Error: Missing required columns: {', '.join(missing_columns)}"
        
        if df.empty:
            return False, "Error: The CSV file is empty."
            
        return True, df
    except Exception as e:
        return False, f"Error reading CSV: {str(e)}"

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        success, result = validate_csv(sys.argv[1])
        if success:
            print("CSV Validation Successful")
        else:
            print(result)
    else:
        print("Usage: python csv_validator.py <path_to_csv>")
