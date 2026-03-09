export async function extractPlaceId(mapsUrl: string): Promise<string | null> {
  // 1. If we already have a ChIJ place_id in the URL, use it directly
  let chMatch = mapsUrl.match(/place_id=(ChI[a-zA-Z0-9_\-]+)/);
  if (chMatch) return chMatch[1];

  let currentUrl = mapsUrl;

  // 2. Resolve short URL to its canonical form
  if (mapsUrl.includes('goo.gl/maps') || mapsUrl.includes('maps.app.goo.gl')) {
    try {
      const response = await fetch(mapsUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' } // Sometimes required by Google
      });
      currentUrl = response.url;
    } catch (e) {
      console.error("Failed to resolve short URL", e);
    }
  }

  // 3. Try to extract Name AND Coordinates from the canonical URL
  // Matches: .../place/Name+Here/@lat,lng,zoom...
  const nameMatch = currentUrl.match(/\/place\/([^\/]+)\//);
  const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  if (nameMatch) {
    const extractedName = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ');
    let location: { lat: string; lng: string } | undefined;

    if (coordMatch) {
      location = { lat: coordMatch[1], lng: coordMatch[2] };
    }

    return await findPlaceByText(extractedName, location);
  }

  // Fallback to URL query parameter if available
  const urlParams = new URL(currentUrl);
  if (urlParams.searchParams.has('query')) {
    return await findPlaceByText(urlParams.searchParams.get('query')!);
  }

  return null;
}

async function findPlaceByText(query: string, location?: { lat: string; lng: string }): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Use Text Search API which is better for "name + location" than Find Place From Text
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

  const params: any = {
    query: query,
    key: apiKey || ''
  };

  // If location is provided, use it as a bias with a tight radius
  if (location) {
    params.location = `${location.lat},${location.lng}`;
    params.radius = '100'; // 100 meters - very strict for the specific listing
  }

  const response = await fetch(`${baseUrl}?${new URLSearchParams(params).toString()}`);
  const data = await response.json();

  if (data.status === 'OK' && data.results && data.results.length > 0) {
    // If multiple results, prioritize the one with the exact name match if possible
    // but usually the 100m radius + query will return the correct one first.
    return data.results[0].place_id;
  }

  // Fallback for Find Place if Text Search failed (broad search)
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
      return fbData.candidates[0].place_id;
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

  // Take up to maxImages
  const selectedPhotos = photos.slice(0, maxImages);

  return selectedPhotos.map(photo => {
    const params = new URLSearchParams({
      maxwidth: '1024', // Requirement: Resize images before inference to max 1024px
      photo_reference: photo.photo_reference,
      key: apiKey || ''
    });
    return `${baseUrl}?${params.toString()}`;
  });
}
