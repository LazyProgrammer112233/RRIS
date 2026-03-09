export async function extractPlaceId(mapsUrl: string): Promise<string | null> {
  // Try to match standard pb=!1s{place_id} format
  let match = mapsUrl.match(/!1s([^!&?]+)/);
  if (match) return match[1];

  // Try to match CID format or search parameters directly
  // Real implementation needs to call Places API Find Place if place_id isn't directly observable
  const url = new URL(mapsUrl);
  
  if (url.searchParams.has('query')) {
    return await findPlaceFromQuery(url.searchParams.get('query')!);
  }
  
  // If it's a short URL (goo.gl/maps), we would need to resolve it first
  if (mapsUrl.includes('goo.gl/maps') || mapsUrl.includes('maps.app.goo.gl')) {
    try {
      const response = await fetch(mapsUrl, { redirect: 'follow' });
      return await extractPlaceId(response.url);
    } catch (e) {
      console.error("Failed to resolve short URL", e);
    }
  }

  return null;
}

async function findPlaceFromQuery(query: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
  
  const params = new URLSearchParams({
    input: query,
    inputtype: 'textquery',
    fields: 'place_id',
    key: apiKey || ''
  });

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  const data = await response.json();

  if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
    return data.candidates[0].place_id;
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
