export async function extractPlaceId(mapsUrl: string): Promise<string | null> {
  // 1. If we already have a ChIJ place_id in the URL, use it directly
  let chMatch = mapsUrl.match(/place_id=(ChI[a-zA-Z0-9_\-]+)/);
  if (chMatch) return chMatch[1];

  let currentUrl = mapsUrl;

  // 2. Resolve short URL to its canonical form securely
  if (mapsUrl.includes('goo.gl') || mapsUrl.includes('maps.app.goo.gl')) {
    try {
      const response = await fetch(mapsUrl, {
        redirect: 'manual', // intercept the redirect manually
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      // The location header contains the expanded canonical URL
      const location = response.headers.get('location');
      if (location) {
        currentUrl = location;
      } else {
        // If no location header, the response url might still be expanded if fetch followed it anyway
        currentUrl = response.url || mapsUrl;
      }
    } catch (e) {
      console.error("[RRIS] Failed to resolve short URL manually", e);
    }
  }

  // Check again if the resolved URL now has the explicit place_id
  chMatch = currentUrl.match(/place_id=(ChI[a-zA-Z0-9_\-]+)/);
  if (chMatch) return chMatch[1];

  // 3. Try to extract Name AND Coordinates from the canonical URL
  const nameMatch = currentUrl.match(/\/place\/([^\/]+)\//);
  const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  if (nameMatch) {
    const extractedName = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ');
    let location: { lat: string; lng: string } | undefined;

    if (coordMatch) {
      location = { lat: coordMatch[1], lng: coordMatch[2] };
      console.log(`[RRIS] Parsed location: ${location.lat}, ${location.lng}`);
    }

    return await findPlaceByText(extractedName, location);
  }

  // Fallback 1: Query parameter search (?query=store+name)
  let urlParams;
  try {
    urlParams = new URL(currentUrl);
  } catch (e) { /* Ignore invalid URLs at this stage */ }

  if (urlParams && urlParams.searchParams.has('query')) {
    const query = urlParams.searchParams.get('query')!;
    // Simple coordinate extraction from query if it looks like lat,lng
    const qCoord = query.match(/(-?\d+\.\d+),(-?\d+\.\d+)/);
    let placeId = null;
    if (qCoord) {
      placeId = await findPlaceByText("Retail Store", { lat: qCoord[1], lng: qCoord[2] });
    } else {
      placeId = await findPlaceByText(query);
    }
    return placeId ? placeId.replace(/[^a-zA-Z0-9_\-]/g, '') : null;
  }

  return null;
}

async function findPlaceByText(query: string, location?: { lat: string; lng: string }): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Use Text Search API
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

  const params: any = {
    query: query,
    key: apiKey || ''
  };

  if (location) {
    params.location = `${location.lat},${location.lng}`;
    params.radius = '100';
  }

  const response = await fetch(`${baseUrl}?${new URLSearchParams(params).toString()}`);
  const data = await response.json();

  if (data.status === 'OK' && data.results && data.results.length > 0) {
    // Sanitize returned Place ID
    return data.results[0].place_id.replace(/[^a-zA-Z0-9_\-]/g, '');
  }

  // Fallback for Find Place if Text Search failed
  if (data.status === 'ZERO_RESULTS' && location) {
    const fallbackUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
    const fallbackParams = new URLSearchParams({
      input: query,
      inputtype: 'textquery',
      fields: 'place_id',
      key: apiKey || ''
    });
    const fbResponse = await fetch(`${fallbackUrl}?${fallbackParams.toString()}`);
    const fbData = await fbResponse.json();
    if (fbData.status === 'OK' && fbData.candidates?.length > 0) {
      return fbData.candidates[0].place_id.replace(/[^a-zA-Z0-9_\-]/g, '');
    }
  }

  return null;
}

export async function getPlaceDetails(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,formatted_address,photos',
    key: apiKey || ''
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Places API Error: ${data.status}`);
  }

  return data.result;
}

export function buildPhotoUrls(photos: any[], maxImages: number = 15): string[] {
  if (!photos || photos.length === 0) return [];

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/photo';

  const selectedPhotos = photos.slice(0, maxImages);

  return selectedPhotos.map(photo => {
    const params = new URLSearchParams({
      maxwidth: '1024',
      photo_reference: photo.photo_reference,
      key: apiKey || ''
    });
    return `${baseUrl}?${params.toString()}`;
  });
}
