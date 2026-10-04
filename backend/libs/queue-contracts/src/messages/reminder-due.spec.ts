import {
  isReminderDueMessage,
  reminderDueJobId,
  reminderDuePublishOptions,
} from './reminder-due';

describe('reminder-due', () => {
  const valid = {
    reminderId: 'r-1',
    fireAt: '2026-10-09T13:25:00.000Z',
    candleLighting: '2026-10-09T14:55:00.000Z',
  };

  it('accepts a valid message', () => {
    expect(isReminderDueMessage(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['no reminderId', { ...valid, reminderId: '' }],
    ['a bad fireAt', { ...valid, fireAt: 'soon' }],
    ['no candleLighting', { ...valid, candleLighting: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isReminderDueMessage(value)).toBe(false);
  });

  it('builds a BullMQ-safe job id from the reminder and fire time', () => {
    const id = reminderDueJobId('r-1', new Date(valid.fireAt));
    expect(id).toBe(`r-1_${Date.parse(valid.fireAt)}`);
    expect(id).not.toContain(':');
  });

  it('delays until fireAt, or not at all when it has passed', () => {
    const fireAt = Date.parse(valid.fireAt);
    expect(reminderDuePublishOptions(valid, fireAt - 60_000)).toMatchObject({
      jobId: reminderDueJobId('r-1', new Date(fireAt)),
      delayMs: 60_000,
      attempts: 8,
    });
    expect(reminderDuePublishOptions(valid, fireAt + 5_000).delayMs).toBe(0);
  });
});
