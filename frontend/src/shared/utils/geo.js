const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle (haversine) distance in km between two { lat, lon } points.
export function distanceKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// A location rounded to ~1 km, as a string: GPS wobble gives the same one, a real move doesn't.
export const placeOf = (coords) =>
  `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
