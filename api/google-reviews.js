let cache = {
  data: null,
  timestamp: 0
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours cache

export default async function googleReviewsHandler(req, res) {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp < CACHE_TTL_MS)) {
    return res.status(200).json(cache.data);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const defaultCount = parseInt(process.env.GOOGLE_REVIEWS_COUNT || '8', 10);
  const defaultRating = parseFloat(process.env.GOOGLE_REVIEWS_RATING || '5.0');

  // If Places API key and Place ID are provided, fetch dynamically from Google Places API
  if (apiKey && placeId) {
    try {
      // Places API (New) - the legacy Place Details endpoint can no longer be enabled on new Google Cloud projects
      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount'
        }
      });
      const data = await response.json();
      if (response.ok && data && data.rating !== undefined) {
        const payload = {
          rating: data.rating || defaultRating,
          reviewCount: data.userRatingCount || defaultCount,
          source: 'google_places_api'
        };
        cache = { data: payload, timestamp: now };
        return res.status(200).json(payload);
      }
      console.error('Google Places API error:', data && data.error ? data.error.message : response.status);
    } catch (err) {
      console.error('Error fetching Google Places API:', err);
    }
  }

  const payload = {
    rating: defaultRating,
    reviewCount: defaultCount,
    source: 'default'
  };
  cache = { data: payload, timestamp: now };
  return res.status(200).json(payload);
}
