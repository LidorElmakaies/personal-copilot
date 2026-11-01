import FormActions from './FormActions';

export default {
  component: FormActions,
  args: { canSave: true },
  argTypes: { onSave: { action: 'saved' }, onCancel: { action: 'cancelled' } },
};

export const Default = {};
export const Saving = { args: { saving: true } };
export const Hebrew = { parameters: { language: 'he' } };
