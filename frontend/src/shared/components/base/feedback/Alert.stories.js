import Alert from './Alert';

export default {
  component: Alert,
  parameters: { language: 'en' },
  args: { children: "Couldn't reach your PC — you can still add." },
};

export const ErrorVariant = { name: 'Error' };
export const Warning = {
  args: { variant: 'warning', children: '2 entries waiting for your PC' },
};
export const Success = {
  args: { variant: 'success', children: 'October is closed' },
};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { children: 'לא ניתן להתחבר למחשב — אפשר עדיין להוסיף' },
};
