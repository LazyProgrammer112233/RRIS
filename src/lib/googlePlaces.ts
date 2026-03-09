export async function extractPlaceId(mapsUrl: string): Promise<string | null> {
  // If we already have a ChIJ place_id in the URL
  let chMatch = mapsUrl.match(/place_id=(ChI[a-zA-Z0-9_\-]+)/);
  if (chMatch) return chMatch[1];

  let currentUrl = mapsUrl;

  // Resolve short URL to its canonical form
  if (mapsUrl.includes('goo.gl/maps') || mapsUrl.includes('maps.app.goo.gl')) {
    try {
      const response = await fetch(mapsUrl, { redirect: 'follow' });
      currentUrl = response.url;
    } catch (e) {
      console.error("Failed to resolve short URL", e);
    }
  }

  // Use the canonical canonical url to parse the location's Name
  const nameMatch = currentUrl.match(/\/place\/([^\/]+)\//);
  if (nameMatch) {
    const extractedName = decodeURIComponent(nameMatch[1]).replace(/\+/g, ' ');
    return await findPlaceFromQuery(extractedName);
  }

  // Fallback to URL query parameter if available
  const urlParams = new URL(currentUrl);
  if (urlParams.searchParams.has('query')) {
    return await findPlaceFromQuery(urlParams.searchParams.get('query')!);
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
