import axios from "axios";

const TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const geocoderApi = axios.create({
  baseURL: "https://nominatim.openstreetmap.org",
  timeout: 5000,
  headers: {
    // Nominatim requires a descriptive user-agent.
    "User-Agent": "gps-tracker-backend/1.0",
  },
});

const toCacheKey = (latitude, longitude) => {
  const lat = Number(latitude).toFixed(3);
  const lon = Number(longitude).toFixed(3);
  return `${lat},${lon}`;
};

const fromAddressObject = (address) => {
  if (!address) return null;

  const primary =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.town ||
    address.city ||
    address.village ||
    address.hamlet ||
    null;

  const secondary =
    address.state_district ||
    address.county ||
    address.state ||
    null;

  if (primary && secondary) return `${primary}, ${secondary}`;
  if (primary) return primary;
  return null;
};

const fromDisplayName = (displayName) => {
  if (!displayName) return null;

  const parts = String(displayName)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const areaParts = parts.filter((part) => {
    const lower = part.toLowerCase();
    if (lower === "india") return false;
    if (/^\d{4,8}$/.test(part)) return false;
    return true;
  });

  if (areaParts.length >= 2) return `${areaParts[0]}, ${areaParts[1]}`;
  if (areaParts.length === 1) return areaParts[0];
  return null;
};

export const reverseGeocodeArea = async (latitude, longitude) => {
  if (latitude == null || longitude == null) return null;

  const key = toCacheKey(latitude, longitude);
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && now - cached.timestamp < TTL_MS) {
    return cached.value;
  }

  try {
    const response = await geocoderApi.get("/reverse", {
      params: {
        format: "jsonv2",
        lat: Number(latitude),
        lon: Number(longitude),
        zoom: 14,
        addressdetails: 1,
      },
    });

    const value =
      fromAddressObject(response.data?.address) ||
      fromDisplayName(response.data?.display_name) ||
      null;

    cache.set(key, { value, timestamp: now });
    return value;
  } catch (error) {
    return null;
  }
};
