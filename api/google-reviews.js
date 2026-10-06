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
  const defaultCount = parseInt(process.env.GOOGLE_REVIEWS_COUNT || '10', 10);
  const defaultRating = parseFloat(process.env.GOOGLE_REVIEWS_RATING || '5.0');

  // If Places API key and Place ID are provided, fetch dynamically from Google Places API
  if (apiKey && placeId) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.result) {
        const payload = {
          rating: data.result.rating || defaultRating,
          reviewCount: data.result.user_ratings_total || defaultCount,
          source: 'google_places_api'
        };
        cache = { data: payload, timestamp: now };
        return res.status(200).json(payload);
      }
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
