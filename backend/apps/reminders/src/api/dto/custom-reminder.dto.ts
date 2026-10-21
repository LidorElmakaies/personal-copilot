import { applyDecorators, BadRequestException } from '@nestjs/common';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type {
  CustomReminder,
  CustomReminderInRange,
  DateRange,
} from '../../models/custom-reminder';

/** English or Hebrew letters, digits and basic punctuation, single spaces between words. */
const TITLE_PATTERN =
  /^[A-Za-zא-ת0-9.,'!?:()"&/-]+(?: [A-Za-zא-ת0-9.,'!?:()"&/-]+)*$/;
const TITLE_MAX_LENGTH = 60;
const REPEATS = ['once', 'daily', 'monthly', 'yearly'] as const;
const CALENDARS = ['gregorian', 'hebrew'] as const;
type Repeat = (typeof REPEATS)[number];
type Calendar = (typeof CALENDARS)[number];

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
// A query string's number: digits only ('', '1e1', ' 9' stay text, so @IsInt refuses them).
const queryInt = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' && /^\d{1,2}$/.test(value) ? Number(value) : value;

// One rule per field, shared by create (required) and PATCH (each optional) — not by inheritance,
// which would carry PATCH's @IsOptional() into create.
const Title = () =>
  applyDecorators(
    Transform(trim),
    IsString(),
    Length(1, TITLE_MAX_LENGTH),
    Matches(TITLE_PATTERN, {
      message:
        'title may contain only English or Hebrew letters, digits, basic punctuation and single spaces',
    }),
  );
const Hour = () => applyDecorators(IsInt(), Min(0), Max(23));
const Minute = () => applyDecorators(IsInt(), Min(0), Max(59));
const RepeatField = () => IsIn(REPEATS);
const CalendarField = () => IsIn(CALENDARS);
const DATE_RULE = { message: '$property must be a date, YYYY-MM-DD' };
const CivilDateField = () =>
  applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, DATE_RULE),
    IsISO8601({ strict: true }, DATE_RULE), // rejects 2026-02-30
  );

/**
 * The months the client shows, both or neither: with them, a change answers with the reminder's
 * `dates` in that range, so the client can show it without asking for the list again.
 */
class ShowingRange {
  @IsOptional() @CivilDateField() from?: string;
  @IsOptional() @CivilDateField() to?: string;
}

export class CreateCustomReminderDto extends ShowingRange {
  @Title() title!: string;
  @Hour() hour!: number;
  @Minute() minute!: number;
  @RepeatField() repeat!: Repeat;
  /** Only used by monthly and yearly; Gregorian if left out. */
  @IsOptional() @CalendarField() calendar?: Calendar;
  @CivilDateField() start!: string;
}

export class UpdateCustomReminderDto extends ShowingRange {
  @IsOptional() @Title() title?: string;
  @IsOptional() @Hour() hour?: number;
  @IsOptional() @Minute() minute?: number;
  @IsOptional() @RepeatField() repeat?: Repeat;
  @IsOptional() @CalendarField() calendar?: Calendar;
  @IsOptional() @CivilDateField() start?: string;
}

export class RangeQueryDto {
  @CivilDateField() from!: string;
  @CivilDateField() to!: string;
}

/** A query string's numbers arrive as text. */
export class PreviewQueryDto {
  @Transform(queryInt) @Hour() hour!: number;
  @Transform(queryInt) @Minute() minute!: number;
  @RepeatField() repeat!: Repeat;
  @IsOptional() @CalendarField() calendar?: Calendar;
  @CivilDateField() start!: string;
}

export class SkipDto extends ShowingRange {
  @CivilDateField() date!: string;
}

/** The client-facing shape: no user id. */
const toCustomReminderResponse = (r: CustomReminder) => ({
  id: r.id,
  title: r.title,
  hour: r.hour,
  minute: r.minute,
  repeat: r.repeat,
  calendar: r.calendar,
  start: r.start,
  skipped: r.skipped,
});

export const toCustomReminderInRangeResponse = (r: CustomReminderInRange) => ({
  ...toCustomReminderResponse(r),
  dates: r.dates,
});

/** A change's answer: with `dates` when a range was sent. */
export const toChangedResponse = (r: CustomReminder | CustomReminderInRange) =>
  'dates' in r
    ? toCustomReminderInRangeResponse(r)
    : toCustomReminderResponse(r);

/** `from` and `to` as a range, both or neither (400). */
export function showingRange({
  from,
  to,
}: {
  from?: string;
  to?: string;
}): DateRange | undefined {
  if (from === undefined && to === undefined) return undefined;
  if (from === undefined || to === undefined)
    throw new BadRequestException('Send both from and to, or neither');
  return { from, to };
}
