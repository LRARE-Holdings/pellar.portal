const BASE_URL = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult {
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
}

interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
}

interface PlaceDetailsResult {
  name: string;
  formatted_address?: string;
  website?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
}

export async function findBusiness(params: {
  query: string;
  region: string;
}): Promise<PlaceResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;

  const searchUrl = `${BASE_URL}/textsearch/json?query=${encodeURIComponent(params.query)}&region=${params.region}&key=${key}`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) return null;

  const searchData = (await searchResponse.json()) as {
    results?: PlaceSearchResult[];
  };
  const firstResult = searchData.results?.[0];
  if (!firstResult) return null;

  const detailsUrl = `${BASE_URL}/details/json?place_id=${firstResult.place_id}&fields=name,formatted_address,website,formatted_phone_number,rating,user_ratings_total&key=${key}`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) return null;

  const detailsData = (await detailsResponse.json()) as {
    result?: PlaceDetailsResult;
  };
  const details = detailsData.result;
  if (!details) return null;

  return {
    name: details.name,
    address: details.formatted_address || "",
    website: details.website || null,
    phone: details.formatted_phone_number || null,
    rating: details.rating || null,
    reviewCount: details.user_ratings_total || null,
  };
}
