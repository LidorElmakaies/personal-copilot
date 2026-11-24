import { useState } from 'react';
import { ScrollView } from 'react-native';
import {
  EXAMPLE_PHOTOS,
  OCTOBER_ENTRIES,
  pickExamplePhotos,
  TODAY,
} from '../mocks';
import EntryDetails from './EntryDetails';

const today = OCTOBER_ENTRIES.filter((e) => e.occurredOn === TODAY);
const groceries = today.find((e) => e.description === 'Weekly groceries');

// Photos added and removed here only.
const Details = ({ photoCount = 0, ...args }) => {
  const [photos, setPhotos] = useState(EXAMPLE_PHOTOS.slice(0, photoCount));
  return (
    <ScrollView>
      <EntryDetails {...args} photos={photos} onChangePhotos={setPhotos} />
    </ScrollView>
  );
};

export default {
  component: EntryDetails,
  parameters: { language: 'en' },
  render: (args) => <Details {...args} />,
  args: {
    entry: groceries,
    categories: ['Groceries'],
    today: TODAY,
    statementMonth: 10,
    photoCount: 2,
    pickPhotos: pickExamplePhotos,
  },
  argTypes: {
    onEdit: { action: 'edit' },
    onDelete: { action: 'deleted' },
    onBack: { action: 'back' },
  },
};

export const PhotosAndMatched = {};
export const NoPhotos = { args: { photoCount: 0 } };
export const ManyPhotos = { args: { photoCount: 8 } };
export const NotMatched = {
  args: { entry: { ...groceries, statementLine: null } },
};
export const NotSent = {
  args: {
    entry: today.find((e) => e.notSent),
    categories: ['Eating out'],
    photoCount: 0,
  },
};
export const Received = {
  args: {
    entry: {
      ...groceries,
      description: 'Sold a bookshelf',
      direction: 'income',
      paidWith: 'bit',
      cardLast4: null,
      statementLine: null,
    },
    categories: [],
    photoCount: 0,
  },
};
export const LongText = {
  args: {
    entry: {
      ...groceries,
      description: 'Groceries and cleaning stuff for the week',
    },
    categories: ['Groceries', 'מתנות', 'Shopping'],
  },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: {
    entry: { ...groceries, description: 'קניות שבועיות בשופרסל דיל' },
    categories: ['סופר', 'Eating out'],
  },
};
export const HebrewNotMatched = {
  parameters: { language: 'he' },
  args: { entry: { ...groceries, statementLine: null }, photoCount: 0 },
};
