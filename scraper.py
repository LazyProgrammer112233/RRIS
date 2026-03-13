import asyncio
import os
import re
import requests
import googlemaps
from dotenv import load_dotenv

load_dotenv(".env.local") if os.path.exists(".env.local") else load_dotenv()

# Note: We still use async for compatibility with the existing main.py structure,
# but the underlying calls are synchronous googlemaps API requests.

def get_maps_client():
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
         raise ValueError("GOOGLE_PLACES_API_KEY environment variable is not set.")
    return googlemaps.Client(key=api_key)

async def _resolve_short_url(maps_url: str) -> str:
    """Manually resolve maps.app.goo.gl and goo.gl links."""
    if "maps.app.goo.gl" in maps_url or "goo.gl" in maps_url:
        try:
            print(f"[Scraper] Resolving short URL: {maps_url}")
            resp = requests.get(
                maps_url,
                allow_redirects=True,
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            )
            # Sometimes requests gets the final URL, sometimes it returns a redirect page
            if "google.com/maps" in resp.url or "google.co" in resp.url:
                print(f"[Scraper] Resolved to: {resp.url}")
                return resp.url
            
            # If still short, try looking for the meta refresh or JS redirect in the body
            if resp.status_code == 200:
                 match = re.search(r'URL=([^"]+)"', resp.text)
                 if match:
                      url = match.group(1).replace("&amp;", "&")
                      print(f"[Scraper] Resolved via meta refresh: {url}")
                      return url
        except Exception as e:
            print(f"[Scraper] Short URL resolution failed: {e}")
    return maps_url


async def get_place_details(place_id: str):
    """Fetches detailed place information from Google Places API."""
    gmaps = get_maps_client()
    try:
        details = gmaps.place(
            place_id=place_id, 
            fields=["name", "type", "formatted_address", "geometry", "rating", "user_ratings_total", "photo"]
        )
        return details.get("result", {})
    except Exception as e:
        print(f"[Scraper] Error fetching place details for {place_id}: {e}")
        return {}

async def scrape_google_maps_photos(maps_url=None, place_id=None, max_photos=10):
    """
    Scrapes Google Maps photos and details using Place ID or URL.
    """
    gmaps = get_maps_client()
    
    # 1. If no Place ID, extract it from URL
    if not place_id and maps_url:
        current_url = await _resolve_short_url(maps_url)
        ch_match = re.search(r'place_id=(ChI[a-zA-Z0-9_\-]+)', current_url)
        if ch_match:
            place_id = ch_match.group(1)
        
        if not place_id:
            name_match = re.search(r'/place/([^/]+)/', current_url)
            coord_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', current_url)
            if name_match:
                try:
                    import urllib.parse
                    name = urllib.parse.unquote(name_match.group(1)).replace("+", " ")
                    location = None
                    if coord_match:
                         location = (float(coord_match.group(1)), float(coord_match.group(2)))
                    search_res = gmaps.places(query=name, location=location, radius=100 if location else None)
                    if search_res and search_res.get("results"):
                        place_id = search_res["results"][0]["place_id"]
                except Exception: pass

    if not place_id:
         print("[Scraper] Could not determine Place ID.")
         return [], {}

    # 4. Fetch Place Details
    print(f"[Scraper] Fetching details for Place ID: {place_id}")
    result = await get_place_details(place_id)
    
    if not result:
         return [], {}
         
    photos = result.get("photos", [])
    print(f"[Scraper] Found {len(photos)} photos.")
    
    # 5. Build high-res photo URLs
    high_res_urls = []
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    for i, photo in enumerate(photos):
         if i >= max_photos:
              break
         photo_ref = photo["photo_reference"]
         photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference={photo_ref}&key={api_key}"
         high_res_urls.append(photo_url)
         
    return high_res_urls, result

if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv
    load_dotenv(".env.local")
    test_input = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        test_input = sys.argv[1]
        
    if test_input.startswith("ChIJ"):
        print(f"Testing with Place ID: {test_input}")
        urls, details = asyncio.run(scrape_google_maps_photos(place_id=test_input))
    else:
        print(f"Testing with URL: {test_input}")
        urls, details = asyncio.run(scrape_google_maps_photos(maps_url=test_input))
    print(f"Store Name: {details.get('name')}")
    for i, url in enumerate(urls):
        print(f"{i+1}: {url}")
