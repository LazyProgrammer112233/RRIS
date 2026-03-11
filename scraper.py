import asyncio
import os
import re
import requests
import googlemaps

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


async def scrape_google_maps_photos(maps_url, max_photos=10):
    """
    Scrapes Google Maps photos using the official Google Places API.
    This replaces the Playwright scraper to bypass HF headless browser blocking.
    """
    gmaps = get_maps_client()
    
    # 1. Expand the URL if needed
    current_url = await _resolve_short_url(maps_url)
    
    # 2. Extract Place ID if present in the URL (ChIJ...)
    place_id = None
    ch_match = re.search(r'place_id=(ChI[a-zA-Z0-9_\-]+)', current_url)
    if ch_match:
        place_id = ch_match.group(1)
        print(f"[Scraper] Extracted Place ID from URL: {place_id}")
    
    # 3. If no Place ID, try to extract name and coords for a Text Search
    if not place_id:
        name_match = re.search(r'/place/([^/]+)/', current_url)
        coord_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', current_url)
        
        if name_match:
            try:
                import urllib.parse
                name = urllib.parse.unquote(name_match.group(1)).replace("+", " ")
                print(f"[Scraper] Extracted store name for search: {name}")
                
                location = None
                if coord_match:
                     location = (float(coord_match.group(1)), float(coord_match.group(2)))
                     print(f"[Scraper] Using location bias: {location}")

                # Use Places API Text Search
                search_res = gmaps.places(query=name, location=location, radius=100 if location else None)
                if search_res and search_res.get("results"):
                    place_id = search_res["results"][0]["place_id"]
                    print(f"[Scraper] Found Place ID via Text Search: {place_id}")
                else:
                    print("[Scraper] Text Search returned no results.")
            except Exception as e:
                 print(f"[Scraper] Text Search failed: {e}")
                 
    if not place_id:
         print("[Scraper] Could not determine Place ID from URL.")
         return []

    # 4. Fetch Place Details (Photos)
    print(f"[Scraper] Fetching details for Place ID: {place_id}")
    try:
        details = gmaps.place(place_id=place_id, fields=["name", "photo"])
        result = details.get("result", {})
        
        if not result or "photos" not in result:
             print("[Scraper] No photos found for this location.")
             return []
             
        photos = result["photos"]
        print(f"[Scraper] Found {len(photos)} photos in Google Places.")
        
        # 5. Build high-res photo URLs Using the Places API Photo Endpoint
        high_res_urls = []
        api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
        for i, photo in enumerate(photos):
             if i >= max_photos:
                  break
             photo_ref = photo["photo_reference"]
             # The URL directly to the Image (Google handles the redirect to lh3.googleusercontent)
             photo_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference={photo_ref}&key={api_key}"
             high_res_urls.append(photo_url)
             
        print(f"[Scraper] Built {len(high_res_urls)} high-res photo URLs via API.")
        return high_res_urls
        
    except Exception as e:
         print(f"[Scraper] Place Details fetching failed: {e}")
         return []

if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv
    load_dotenv(".env.local") # Load for local testing
    test_url = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        
    urls = asyncio.run(scrape_google_maps_photos(test_url))
    for i, url in enumerate(urls):
        print(f"{i+1}: {url}")
