import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { maps_url } = await req.json();

        if (!maps_url) {
            return NextResponse.json({ error: 'maps_url is required' }, { status: 400 });
        }

        // Only try to resolve if it's a known Google shortlink
        if (!maps_url.includes('maps.app.goo.gl') && !maps_url.includes('goo.gl')) {
            return NextResponse.json({ resolved_url: maps_url }, { status: 200 });
        }

        console.log(`[Frontend Resolver] Resolving short URL: ${maps_url}`);

        // Try standard fetch redirect resolution
        try {
            const response = await fetch(maps_url, {
                redirect: 'manual', // intercept the redirect manually
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            const location = response.headers.get('location');
            if (location) {
                console.log(`[Frontend Resolver] Extracted from Location header: ${location}`);
                return NextResponse.json({ resolved_url: location }, { status: 200 });
            }

            // If no location header, the response url might still be expanded if fetch followed it anyway
            if (response.url && response.url !== maps_url) {
                console.log(`[Frontend Resolver] Extracted from response.url: ${response.url}`);
                return NextResponse.json({ resolved_url: response.url }, { status: 200 });
            }

            // Sometimes Firebase Dynamic Links returns a 200 with a meta refresh
            const text = await response.text();
            const match = text.match(/URL=([^"]+)"/);
            if (match && match[1]) {
                const metaUrl = match[1].replace(/&amp;/g, "&");
                console.log(`[Frontend Resolver] Extracted from meta refresh: ${metaUrl}`);
                return NextResponse.json({ resolved_url: metaUrl }, { status: 200 });
            }

        } catch (e) {
            console.error("[Frontend Resolver] Fetch failed", e);
        }

        // Fallback: return original if all fails
        return NextResponse.json({ resolved_url: maps_url }, { status: 200 });

    } catch (error: any) {
        console.error('[Frontend Resolver] Server error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
