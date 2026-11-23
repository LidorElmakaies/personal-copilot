const LINES = 2;

// Whether chips this wide wrap onto at most LINES rows of `room`.
function fits(widths, room, gap) {
  let row = 1;
  let used = 0;
  for (const w of widths) {
    if (used > 0 && used + gap + w > room) {
      row += 1;
      used = w;
    } else {
      used += (used > 0 ? gap : 0) + w;
    }
  }
  return row <= LINES;
}

// The ids whose chips show before "More…": all of them when they fit LINES rows of `room`, else as
// many first ones as leave room for "More…" (`moreWidth`), with `keepIds` (the selected ones)
// always among them, on more rows if these can't hold them. `widthOf(id)` is a chip's width.
export function chipsThatFit(
  ids,
  widthOf,
  { moreWidth, room, gap, keepIds = [] },
) {
  if (fits(ids.map(widthOf), room, gap)) return ids;
  for (let n = ids.length - 1; n > 0; n -= 1) {
    const first = ids.slice(0, n);
    const shown = ids.filter(
      (id) => first.includes(id) || keepIds.includes(id),
    );
    // Everything but "More…" itself would leave it nothing to open.
    if (
      shown.length < ids.length &&
      fits([...shown.map(widthOf), moreWidth], room, gap)
    ) {
      return shown;
    }
  }
  const kept = ids.filter((id) => keepIds.includes(id));
  return kept.length ? kept : ids.slice(0, 1);
}
