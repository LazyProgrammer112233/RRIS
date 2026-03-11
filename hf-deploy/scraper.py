import asyncio
import re
import os
from playwright.async_api import async_playwright

import random

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
]

async def resolve_high_res_url(url):
    """
    Transforms a Google Maps photo URL to its highest resolution.
    Pattern: replaces =w...-h... or =s... with =s0 (original quality).
    """
    if not url: return url
    # Pattern for various resolution suffixes like =w100-h100-p or =s1600-w1000
    transformed = re.sub(r'=[sw]\d+.*', '=s0', url)
    return transformed

async def scrape_google_maps_photos(maps_url, max_photos=10):
    """
    Enhanced Universal Scraper for Google Maps with Stealth Measures.
    """
    async with async_playwright() as p:
        # User-Agent Rotation
        ua = random.choice(USER_AGENTS)
        
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=ua,
            viewport={"width": random.randint(1280, 1920), "height": random.randint(720, 1080)}
        )
        page = await context.new_page()

        # Intercept image URLs from network traffic
        intercepted_images = []
        def handle_request(request):
            url = request.url
            if "googleusercontent.com" in url and "/p/" in url:
                intercepted_images.append(url)

        page.on("request", handle_request)

        print(f"[Scraper] Navigating to: {maps_url}")
        try:
            # wait_until='commit' is fastest, then we manually wait for key elements
            await page.goto(maps_url, wait_until="commit", timeout=60000)
        except Exception as e:
            print(f"[Scraper] Navigation error: {e}")

        # Wait for the main pane to render
        await page.wait_for_timeout(10000)
        
        # 1. Try to find and click the "Photos" link via href pattern
        try:
            # Common pattern for photos link
            photo_link = await page.query_selector('a[href*="/photos/"]')
            if photo_link:
                print("[Scraper] Found Photos link by href, clicking...")
                await photo_link.click()
                await page.wait_for_timeout(5000)
        except:
            pass

        # 2. Collect URLs from DOM and Source
        dom_urls = []
        try:
            # Scan all possible image sources
            elements = await page.query_selector_all('img, div[style*="url("]')
            for el in elements:
                src = await el.get_attribute('src')
                if not src:
                    style = await el.get_attribute('style')
                    if style and 'background-image' in style:
                        match = re.search(r'url\("?([^"\)]+)"?\)', style)
                        if match: src = match.group(1)
                if src: dom_urls.append(src)
        except:
            pass
        
        # 3. Last Resort: Scan the entire page content for photo patterns
        try:
            content = await page.content()
            raw_matches = re.findall(r'https://[^"\s]*googleusercontent\.com/p/[A-Za-z0-9_-]+', content)
            dom_urls.extend(raw_matches)
        except:
            pass

        await browser.close()
        
        # Final set of unique URLs
        all_found = intercepted_images + dom_urls
        unique_urls = list(dict.fromkeys(all_found))
        
        # Limit and transform to high-res
        high_res_urls = []
        for url in unique_urls:
            if "googleusercontent" in url and "/p/" in url:
                hr_url = await resolve_high_res_url(url)
                high_res_urls.append(hr_url)
            if len(high_res_urls) >= max_photos:
                break
                
        print(f"[Scraper] Successfully extracted {len(high_res_urls)} high-res photos.")
        return high_res_urls

if __name__ == "__main__":
    import sys
    test_url = "https://www.google.com/maps/place/Reliance+Fresh/@19.0760,72.8777,15z"
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        
    loop = asyncio.get_event_loop()
    urls = loop.run_until_complete(scrape_google_maps_photos(test_url))
    for i, url in enumerate(urls):
        print(f"{i+1}: {url}")
