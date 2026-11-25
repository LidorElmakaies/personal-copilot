import { STATEMENT_ERRORS } from '../mocks';
import StatementError from './StatementError';

export default {
  component: StatementError,
  parameters: { language: 'en' },
  args: { error: STATEMENT_ERRORS.totalsMismatch, source: 'text' },
  argTypes: {
    onStartOver: { action: 'startOver' },
    onRetry: { action: 'retry' },
  },
};

const hebrew = { language: 'he' };

export const TotalsMismatch = {};
export const TotalsMismatchFile = { args: { source: 'file' } };
export const NotMaxFile = {
  args: { error: STATEMENT_ERRORS.notMaxFile, source: 'file' },
};
export const LlmUnreachable = {
  args: { error: STATEMENT_ERRORS.llmUnreachable },
};
export const Unknown = { args: { error: STATEMENT_ERRORS.unknown } };
export const HebrewTotalsMismatch = { parameters: hebrew };
export const HebrewNotMaxFile = {
  parameters: hebrew,
  args: { error: STATEMENT_ERRORS.notMaxFile, source: 'file' },
};
export const HebrewLlmUnreachable = {
  parameters: hebrew,
  args: { error: STATEMENT_ERRORS.llmUnreachable },
};
export const HebrewUnknown = {
  parameters: hebrew,
  args: { error: STATEMENT_ERRORS.unknown },
};
