import requests
import os
from dotenv import load_dotenv

load_dotenv(".env.local")

API_URL = "https://ishan8800-fa-space.hf.space"
# API_URL = "http://127.0.0.1:7860"
SECRET = "rris-prod-2026-secret"

print(f"Testing root endpoint on {API_URL}...")
try:
    r = requests.get(f"{API_URL}/", headers={"X-RRIS-SECRET": SECRET})
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")
except Exception as e:
    print(f"Error: {e}")

print(f"\nTesting /health...")
try:
    r = requests.get(f"{API_URL}/health")
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")
except Exception as e:
    print(f"Error: {e}")

print(f"\nTesting /audit-bulk-ids (empty POST)...")
try:
    r = requests.post(f"{API_URL}/audit-bulk-ids", headers={"X-RRIS-SECRET": SECRET}, json={"place_ids": []})
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")
except Exception as e:
    print(f"Error: {e}")
