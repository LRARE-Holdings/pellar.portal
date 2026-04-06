// Google Places API (New) — uses the v1 REST endpoint
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const BASE_URL = "https://places.googleapis.com/v1/places";

interface PlaceResult {
  name: string;
  address: string;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
}

interface NewPlaceSearchResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    rating?: number;
    userRatingCount?: number;
  }>;
}

export async function findBusiness(params: {
  query: string;
  region: string;
}): Promise<PlaceResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;

  try {
    // Text Search (New) — single request that returns all fields
    const response = await fetch(`${BASE_URL}:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: params.query,
        regionCode: params.region.toUpperCase(),
        maxResultCount: 1,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as NewPlaceSearchResponse;
    const place = data.places?.[0];
    if (!place) return null;

    return {
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      website: place.websiteUri || null,
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
      rating: place.rating || null,
      reviewCount: place.userRatingCount || null,
    };
  } catch {
    return null;
  }
}
