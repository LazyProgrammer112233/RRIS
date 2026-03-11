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
    transformed = re.sub(r'=[sw]\d+.*', '=s0', url)
    return transformed

async def scrape_google_maps_photos(maps_url, max_photos=10):
    """
    Enhanced Universal Scraper for Google Maps with Stealth Measures.
    Hardened for headless environments (HF Spaces).
    """
    async with async_playwright() as p:
        # User-Agent Rotation
        ua = random.choice(USER_AGENTS)
        
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
            ]
        )
        context = await browser.new_context(
            user_agent=ua,
            viewport={"width": random.randint(1280, 1920), "height": random.randint(720, 1080)},
            locale='en-US',
            timezone_id='America/New_York',
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
            await page.goto(maps_url, wait_until="domcontentloaded", timeout=60000)
        except Exception as e:
            print(f"[Scraper] Navigation error (continuing anyway): {e}")

        # Handle Google Consent Banner (common in headless environments)
        try:
            consent_btn = await page.query_selector('button[aria-label*="Accept"], form[action*="consent"] button')
            if consent_btn:
                print("[Scraper] Consent banner detected, accepting...")
                await consent_btn.click()
                await page.wait_for_timeout(3000)
        except:
            pass

        # Wait for the main pane to fully render
        print("[Scraper] Waiting for page to fully load...")
        await page.wait_for_timeout(15000)
        
        # Debug: Log page title and URL
        current_url = page.url
        title = await page.title()
        print(f"[Scraper] Page loaded — Title: {title}")
        print(f"[Scraper] Final URL: {current_url}")
        
        # 1. Try to find and click the "Photos" tab/link
        try:
            # Multiple selectors for the photos button/link
            photo_selectors = [
                'a[href*="/photos/"]',
                'button[aria-label*="Photo"]',
                'button[aria-label*="photo"]',
                '[data-tab-id="photos"]',
                'a[data-item-id="photos"]',
            ]
            for selector in photo_selectors:
                photo_link = await page.query_selector(selector)
                if photo_link:
                    print(f"[Scraper] Found Photos element via: {selector}")
                    await photo_link.click()
                    await page.wait_for_timeout(5000)
                    break
        except Exception as e:
            print(f"[Scraper] Photos tab click error: {e}")

        # 2. Scroll to trigger lazy-loaded images
        try:
            await page.evaluate("window.scrollBy(0, 1000)")
            await page.wait_for_timeout(3000)
        except:
            pass

        # 3. Collect URLs from DOM
        dom_urls = []
        try:
            elements = await page.query_selector_all('img, div[style*="url("]')
            print(f"[Scraper] Found {len(elements)} image/div elements in DOM")
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
        
        # 4. Scan the entire page content for photo patterns (most reliable)
        try:
            content = await page.content()
            raw_matches = re.findall(r'https://[^"\s]*googleusercontent\.com/p/[A-Za-z0-9_-]+', content)
            dom_urls.extend(raw_matches)
            print(f"[Scraper] Regex found {len(raw_matches)} googleusercontent URLs in page source")
        except:
            pass

        # 5. Also check for lh3/lh5 google photo URLs (alternative pattern)
        try:
            content = await page.content()
            lh_matches = re.findall(r'https://lh[35]\.googleusercontent\.com/[^\s"\']+', content)
            dom_urls.extend(lh_matches)
            if lh_matches:
                print(f"[Scraper] Found {len(lh_matches)} lh3/lh5 URLs")
        except:
            pass

        await browser.close()
        
        # Final set of unique URLs
        all_found = intercepted_images + dom_urls
        unique_urls = list(dict.fromkeys(all_found))
        
        print(f"[Scraper] Total intercepted: {len(intercepted_images)}, DOM: {len(dom_urls)}, Unique: {len(unique_urls)}")
        
        # Filter and transform to high-res
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
