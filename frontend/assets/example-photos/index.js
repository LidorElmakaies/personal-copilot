// Made-up receipts (one wide, one long) for stories and the Phase U example data; L5 brings real photos.
export const EXAMPLE_PHOTOS = [
  require('./receipt-1.jpg'),
  require('./receipt-2.jpg'),
  require('./receipt-3.jpg'),
  require('./receipt-4.jpg'),
  require('./receipt-5.jpg'),
  require('./receipt-6.jpg'),
  require('./receipt-7.jpg'),
  require('./receipt-8.jpg'),
].map((source, i) => ({ id: `photo-${i + 1}`, source }));
