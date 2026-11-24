import { useState } from 'react';
import { EXAMPLE_PHOTOS, pickExamplePhotos } from '../mocks';
import PhotosField from './PhotosField';

export default { component: PhotosField, parameters: { language: 'en' } };

// Camera adds one example photo, Gallery two, here only.
const Field = ({ count = 0 }) => {
  const [photos, setPhotos] = useState(EXAMPLE_PHOTOS.slice(0, count));
  return (
    <PhotosField
      photos={photos}
      onChange={setPhotos}
      pickPhotos={pickExamplePhotos}
    />
  );
};

export const Empty = { render: () => <Field /> };
export const One = { render: () => <Field count={1} /> };
export const Eight = { render: () => <Field count={8} /> };
export const Hebrew = {
  parameters: { language: 'he' },
  render: () => <Field count={2} />,
};
