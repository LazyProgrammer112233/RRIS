import requests
import sys

def test_production_health(url):
    """
    Pings the production /health endpoint to verify deployment.
    """
    print(f"🔍 Pinging production health: {url}/health")
    try:
        response = requests.get(f"{url}/health", timeout=10)
        response.raise_for_status()
        data = response.json()
        
        status = data.get("status")
        browser = data.get("browser")
        
        if status == "ready" and browser == "installed":
            print("✅ Production Backend is LIVE and BROWSER is ready!")
            print(f"📊 Report: {data}")
        else:
            print(f"⚠️ Backend returned unexpected status: {data}")
            
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        print("Tip: Check if your Railway/Cloud Run instance is sleeping or if the URL is correct.")

if __name__ == "__main__":
    prod_url = "https://rris-api.railway.app"
    if len(sys.argv) > 1:
        prod_url = sys.argv[1]
    
    test_production_health(prod_url)
