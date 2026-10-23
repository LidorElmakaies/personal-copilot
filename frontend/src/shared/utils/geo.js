// A location rounded to ~1 km, as a string: GPS wobble gives the same one, a real move doesn't.
export const placeOf = (coords) =>
  `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
