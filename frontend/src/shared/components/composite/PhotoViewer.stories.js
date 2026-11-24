import { EXAMPLE_PHOTOS } from '../../../../assets/example-photos';
import PhotoViewer from './PhotoViewer';

export default {
  component: PhotoViewer,
  parameters: { language: 'en' },
  args: { photos: EXAMPLE_PHOTOS, index: 0 },
  argTypes: {
    onClose: { action: 'closed' },
    onRemove: { action: 'removed' },
  },
};

export const First = {};
export const Last = { args: { index: EXAMPLE_PHOTOS.length - 1 } };
// One wide, one long: whole, never cropped.
export const Wide = { args: { index: 4 } };
export const Long = { args: { index: 6 } };
export const OnlyOne = { args: { photos: EXAMPLE_PHOTOS.slice(0, 1) } };
export const WontLoad = {
  args: { photos: [{ id: 'gone', source: { uri: 'file:///gone.jpg' } }] },
};
export const Hebrew = { parameters: { language: 'he' } };
