import { useState } from 'react';
import { EXAMPLE_PHOTOS } from '../../../../../assets/example-photos';
import PhotoViewer from '../layout/PhotoViewer';
import PhotoStrip from './PhotoStrip';

export default { component: PhotoStrip, parameters: { language: 'en' } };

// × removes and + adds an example photo, here only; a tap opens it full screen.
const Strip = ({ count }) => {
  const [photos, setPhotos] = useState(EXAMPLE_PHOTOS.slice(0, count));
  const [added, setAdded] = useState(0);
  const [opened, setOpened] = useState(null);
  const add = () => {
    const { source } = EXAMPLE_PHOTOS[added % EXAMPLE_PHOTOS.length];
    setPhotos([...photos, { id: `added-${added}`, source }]);
    setAdded(added + 1);
  };
  return (
    <>
      <PhotoStrip
        photos={photos}
        onAdd={add}
        onRemove={(id) => setPhotos(photos.filter((p) => p.id !== id))}
        onPressPhoto={setOpened}
      />
      <PhotoViewer
        photos={photos}
        index={opened}
        onClose={() => setOpened(null)}
      />
    </>
  );
};

export const None = { render: () => <Strip count={0} /> };
export const One = { render: () => <Strip count={1} /> };
export const Two = { render: () => <Strip count={2} /> };
export const Four = { render: () => <Strip count={4} /> };
export const Eight = { render: () => <Strip count={8} /> };
// No handlers: no × and no add tile.
export const ViewOnly = { args: { photos: EXAMPLE_PHOTOS.slice(0, 3) } };
export const WontLoad = {
  args: {
    photos: [{ id: 'gone', source: { uri: 'file:///gone.jpg' } }],
    onAdd: () => {},
    onRemove: () => {},
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Strip count={2} />,
};
export const HebrewEight = {
  parameters: { language: 'he' },
  render: () => <Strip count={8} />,
};
