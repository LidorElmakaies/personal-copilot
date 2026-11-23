import { chipsThatFit } from './chips';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const MORE_IDS = [...IDS, 'g'];
const wide = (w) => () => w;
// Two rows of three 94s (94 + 6 + 94 + 6 + 94 = 294).
const opts = { moreWidth: 60, room: 300, gap: 6 };

describe('chipsThatFit', () => {
  it('shows everything, with no room kept for "More…", when two rows hold it', () => {
    expect(chipsThatFit(IDS, wide(94), opts)).toEqual(IDS);
  });

  it('otherwise keeps as many as leave room for "More…"', () => {
    expect(chipsThatFit(MORE_IDS, wide(94), opts)).toEqual(IDS.slice(0, 5));
  });

  it('keeps a selected one showing, in the last place', () => {
    expect(
      chipsThatFit(MORE_IDS, wide(94), { ...opts, keepIds: ['g'] }),
    ).toEqual(['a', 'b', 'c', 'd', 'g']);
    expect(
      chipsThatFit(MORE_IDS, wide(94), { ...opts, keepIds: ['b'] }),
    ).toEqual(IDS.slice(0, 5));
  });

  it('keeps several selected, on more rows when two cannot hold them', () => {
    const keep = { ...opts, keepIds: ['f', 'g'] };
    expect(chipsThatFit(MORE_IDS, wide(94), keep)).toEqual([
      'a',
      'b',
      'c',
      'f',
      'g',
    ]);
    const most = { ...opts, keepIds: IDS };
    expect(chipsThatFit(MORE_IDS, wide(94), most)).toEqual(IDS);
  });

  it('ignores a selected id that is not there', () => {
    expect(
      chipsThatFit(MORE_IDS, wide(94), { ...opts, keepIds: ['x'] }),
    ).toEqual(IDS.slice(0, 5));
  });

  it('still shows one when chips are as wide as the row', () => {
    expect(chipsThatFit(IDS, wide(300), opts)).toEqual(['a']);
    expect(chipsThatFit(IDS, wide(300), { ...opts, keepIds: ['f'] })).toEqual([
      'f',
    ]);
  });

  it('no categories', () => {
    expect(chipsThatFit([], wide(94), opts)).toEqual([]);
  });
});
