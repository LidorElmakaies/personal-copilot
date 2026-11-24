// The gallery's arithmetic (PhotoViewer): sizes and shifts in dp, a shift measured from the photo
// centred. Worklets, so its gestures run them on the UI thread.

export const MAX_ZOOM = 4;

const between = (min, value, max) => {
  'worklet';
  return Math.max(min, Math.min(max, value));
};

// The photo's size on screen, whole inside `box`; `box` itself until its own size is known.
export function fitInside(natural, box) {
  'worklet';
  if (!natural?.width || !natural?.height) return box;
  const k = Math.min(box.width / natural.width, box.height / natural.height);
  return { width: natural.width * k, height: natural.height * k };
}

// A shift kept so that no empty space opens between the photo and the screen's edge.
export function limitShift(shift, size, room, scale) {
  'worklet';
  const most = Math.max(0, (size * scale - room) / 2);
  return between(-most, shift, most);
}

// The shift that keeps under the fingers what was under them: `focal` now, `startFocal` and
// `startShift` when the pinch began, `ratio` the zoom since. Focals are from the centre.
export function shiftAround(focal, startFocal, startShift, ratio) {
  'worklet';
  return focal - (startFocal - startShift) * ratio;
}

// A little past the ends: a pinch beyond the limits resists.
export function pinchScale(scale) {
  'worklet';
  return between(0.8, scale, MAX_ZOOM * 1.2);
}

// The place a swipe lands on: one over past a quarter of the way or on a flick, else back.
export function landingPlace(start, position, velocityX, last) {
  'worklet';
  const moved = position - start;
  const step = moved > 0 ? 1 : -1;
  const flick = Math.abs(velocityX) > 600 && Math.sign(-velocityX) === step;
  const go = moved !== 0 && (Math.abs(moved) > 0.25 || flick);
  return between(0, go ? start + step : start, last);
}
