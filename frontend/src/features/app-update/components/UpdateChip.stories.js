import UpdateChip from './UpdateChip';

// Home's chip while 0.7.0 is out (a tap does nothing here). Its only words are TalkBack's.
const state = { appUpdate: { latest: { version: '0.7.0' } } };

export default { component: UpdateChip, parameters: { state } };

export const Default = {};
export const Hebrew = { parameters: { state, language: 'he' } };
