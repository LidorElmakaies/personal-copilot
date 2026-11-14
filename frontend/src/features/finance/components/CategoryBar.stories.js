import CategoryBar from './CategoryBar';

// October as on the canvas: Housing ₪3,200 is the biggest.
const BIGGEST = 320000;

export default {
  component: CategoryBar,
  parameters: { language: 'en' },
  args: { name: 'Housing', amountAgorot: BIGGEST, biggestAgorot: BIGGEST },
};

export const Biggest = {};
export const Part = { args: { name: 'Groceries', amountAgorot: 186000 } };
export const Small = { args: { name: 'Eating out', amountAgorot: 64000 } };
// ₪4.50 next to ₪3,200: still a dot.
export const Tiny = { args: { name: 'Other', amountAgorot: 450 } };
export const Nothing = { args: { name: 'Other', amountAgorot: 0 } };
export const LongName = {
  args: {
    name: 'Kids, school trips and after-school classes',
    amountAgorot: 123456,
  },
};
export const HugeAmount = {
  args: { name: 'Housing', amountAgorot: 12345678, biggestAgorot: 12345678 },
};
// The user's own names, in either language whatever the app's.
export const HebrewNameInEnglish = {
  args: { name: 'תחבורה', amountAgorot: 31000 },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { name: 'חשבונות', amountAgorot: 186000 },
};
export const EnglishNameInHebrew = {
  parameters: { language: 'he' },
  args: { name: 'Groceries', amountAgorot: 64000 },
};
