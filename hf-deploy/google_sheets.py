import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os

def export_to_sheets(json_report_path, spreadsheet_name, credentials_json="service_account.json"):
    """
    Exports RRIS audit report to a Google Sheet.
    Includes 'Brand Infringement' alerts for 'Mixed' purity status.
    """
    if not os.path.exists(json_report_path):
        print(f"❌ Report {json_report_path} not found.")
        return

    if not os.path.exists(credentials_json):
        print(f"⚠️ Service account key {credentials_json} not found. Skipping Sheets export.")
        return

    # Auth
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    
    # Try Env Var first for production, then local file
    env_creds = os.getenv("SERVICE_ACCOUNT_JSON")
    if env_creds:
        try:
            creds_data = json.loads(env_creds)
            creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_data, scope)
            print("🔐 Authenticating via SERVICE_ACCOUNT_JSON Environment Variable.")
        except Exception as e:
            print(f"❌ Failed to parse SERVICE_ACCOUNT_JSON Env Var: {e}")
            return
    elif os.path.exists(credentials_json):
        creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_json, scope)
        print(f"🔐 Authenticating via local file: {credentials_json}")
    else:
        print(f"⚠️ No credentials found (local file {credentials_json} or Env Var). Skipping Sheets export.")
        return

    try:
        client = gspread.authorize(creds)

        # Load data
        with open(json_report_path, "r") as f:
            report_data = json.load(f)

        # Open or create sheet
        try:
            sheet = client.open(spreadsheet_name).sheet1
        except gspread.exceptions.SpreadsheetNotFound:
            print(f"📥 Creating new spreadsheet: {spreadsheet_name}")
            spreadsheet = client.create(spreadsheet_name)
            sheet = spreadsheet.sheet1

        # Prepare Headers
        headers = [
            "Store URL", "Image URL", "Asset Type", "Brand Logo", 
            "Purity", "Alert", "Stock Level", "OCR Confirmed", "Reasoning"
        ]
        
        # Prepare Rows
        rows = [headers]
        for img_entry in report_data.get("audit_data", []):
            for det in img_entry.get("detections", []):
                is_mixed = det["audit"]["purity"] == "Mixed"
                rows.append([
                    report_data["store_maps_url"],
                    img_entry["image_url"],
                    det["audit"]["asset_classification"],
                    det["audit"]["brand_logo"],
                    det["audit"]["purity"],
                    "!!! BRAND INFRINGEMENT !!!" if is_mixed else "PURE",
                    det["audit"]["stock_level"],
                    det["audit"]["confirmed_via_ocr"],
                    det["audit"]["reasoning"]
                ])

        # Overwrite content
        sheet.clear()
        sheet.update('A1', rows)
        
        print(f"✅ Successfully exported {len(rows)-1} records to Google Sheet: {spreadsheet_name}")

    except Exception as e:
        print(f"❌ Google Sheets Export Error: {e}")

if __name__ == "__main__":
    # Example usage
    export_to_sheets("audit_report.json", "RRIS_Audit_Log")
