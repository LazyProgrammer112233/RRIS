# RRIS Industry Bulk Analysis Worker

This tool allows you to perform bulk refrigeration audits on thousands of retail outlets using CSV datasets and local image folders. The analysis runs locally on your machine for maximum privacy and processing speed.

## Prerequisites

1. **Python 3.9+** installed on your system.
2. **Gemini API Key**: Obtain one from [Google AI Studio](https://aistudio.google.com/).

## Installation

1. Extract the `rris_bulk` folder.
2. Open a terminal/command prompt in the `rris_bulk` directory.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Folder Structure

### 1. CSV Dataset
Your CSV must contain the following columns:
- `store_id`: Unique identifier for the store.
- `store_url`: Google Maps URL of the store.
- `store_location`: Physical address or city.

### 2. Image Directory
Store images must be organized in subfolders named after the `store_id`:
```
store_images/
    10001/
        img1.jpg
        img2.jpg
    10002/
        store_front.png
        interior.jpg
```

## Running the Worker

Run the main script:
```bash
python run_rris_bulk.py
```

The script will prompt you for:
1. Your Gemini API Key (saved locally in `.env`).
2. Path to your CSV dataset.
3. Path to your Store Image Directory.
4. Output directory for the results.

## Output

The worker generates `rris_bulk_results.csv` with:
- Store Identification
- Fridge Detection Status (YES/NO)
- Appliance Type & Reasoning
- Confidence Levels
- Analysis Timestamp

## Performance
The worker uses `asyncio` to process 15 stores concurrently. You can adjust this in `config.yaml` if needed.
