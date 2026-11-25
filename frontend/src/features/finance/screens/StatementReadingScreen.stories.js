import { STATEMENT_ERRORS } from '../mocks';
import StatementReadingScreen from './StatementReadingScreen';

export default {
  component: StatementReadingScreen,
  parameters: { layout: 'fullscreen', language: 'en' },
  argTypes: { onDone: { action: 'done' } },
};

// The steps tick by themselves; `done` is logged at the end.
export const Reading = {};
export const TotalsMismatch = {
  args: { error: STATEMENT_ERRORS.totalsMismatch, source: 'text' },
};
export const NotMaxFile = { args: { error: STATEMENT_ERRORS.notMaxFile } };
export const LlmUnreachable = {
  args: { error: STATEMENT_ERRORS.llmUnreachable, source: 'text' },
};
export const Unknown = { args: { error: STATEMENT_ERRORS.unknown } };
export const Hebrew = { parameters: { language: 'he' } };
export const HebrewTotalsMismatch = {
  parameters: { language: 'he' },
  args: { error: STATEMENT_ERRORS.totalsMismatch, source: 'text' },
};
