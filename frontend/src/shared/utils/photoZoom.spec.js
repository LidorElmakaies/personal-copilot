import {
  fitInside,
  landingPlace,
  limitShift,
  pinchScale,
  shiftAround,
} from './photoZoom';

const BOX = { width: 400, height: 800 };

describe('fitInside', () => {
  it('fits a wide, a tall and a small photo whole', () => {
    expect(fitInside({ width: 1200, height: 900 }, BOX)).toEqual({
      width: 400,
      height: 300,
    });
    expect(fitInside({ width: 500, height: 2000 }, BOX)).toEqual({
      width: 200,
      height: 800,
    });
    expect(fitInside({ width: 100, height: 100 }, BOX)).toEqual({
      width: 400,
      height: 400,
    });
  });

  it('is the box until the size is known', () => {
    expect(fitInside(undefined, BOX)).toBe(BOX);
  });
});

describe('limitShift', () => {
  it('reaches the edge of a zoomed photo and no further', () => {
    expect(limitShift(50, 400, 400, 2)).toBe(50);
    expect(limitShift(500, 400, 400, 2)).toBe(200);
    expect(limitShift(-500, 400, 400, 2)).toBe(-200);
  });

  it('stays centred along a side that fits', () => {
    expect(limitShift(90, 300, 800, 2)).toBeCloseTo(0);
  });
});

describe('shiftAround', () => {
  it('keeps the point under the fingers in place', () => {
    const focal = 100;
    const shift = shiftAround(focal, focal, 20, 2);
    // The photo's point there was (100 - 20) from its centre; zoomed twice it's 160 away.
    expect(shift + 160).toBe(focal);
  });

  it('follows fingers that move', () => {
    expect(shiftAround(130, 100, 0, 1)).toBe(30);
  });
});

describe('pinchScale', () => {
  it('resists past the limits', () => {
    expect(pinchScale(0.1)).toBe(0.8);
    expect(pinchScale(2)).toBe(2);
    expect(pinchScale(20)).toBeCloseTo(4.8);
  });
});

describe('landingPlace', () => {
  it('moves one over past a quarter, or on a flick that way', () => {
    expect(landingPlace(1, 1.3, 0, 3)).toBe(2);
    expect(landingPlace(1, 0.7, 0, 3)).toBe(0);
    expect(landingPlace(1, 1.1, -900, 3)).toBe(2);
  });

  it('goes back on a short drag, or a flick the other way', () => {
    expect(landingPlace(1, 1.1, 0, 3)).toBe(1);
    expect(landingPlace(1, 1.1, 900, 3)).toBe(1);
  });

  it('stays inside the ends', () => {
    expect(landingPlace(3, 3.3, -900, 3)).toBe(3);
    expect(landingPlace(0, -0.3, 900, 3)).toBe(0);
  });
});
