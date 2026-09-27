import * as Location from 'expo-location';

// Device I/O, no Redux knowledge — called only from locationSlice's thunk.
export class LocationDeniedError extends Error {}

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new LocationDeniedError('Location permission denied');
  }
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    // The phone's own zone: the backend uses it to decide what "today" is for the user.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
