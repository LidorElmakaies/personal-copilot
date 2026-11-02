import ConfirmModal from './ConfirmModal';

// Yes / No unless the caller names its buttons.
export default {
  component: ConfirmModal,
  parameters: { language: 'en' },
  args: { visible: true, message: 'Log in to view Account?' },
  argTypes: {
    onConfirm: { action: 'confirmed' },
    onCancel: { action: 'cancelled' },
  },
};

export const YesNo = {};
export const Hebrew = {
  parameters: { language: 'he' },
  args: { message: 'להתחבר כדי לפתוח את חשבון?' },
};
