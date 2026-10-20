import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ForwardedUserId } from '@app/auth-kernel';
import { CUSTOM_REMINDER_SERVICE } from '../../tokens';
import type { ICustomReminderService } from '../../application/interfaces/custom-reminder-service.interface';
import {
  CreateCustomReminderDto,
  PreviewQueryDto,
  RangeQueryDto,
  showingRange,
  SkipDto,
  toChangedResponse,
  toCustomReminderInRangeResponse,
  UpdateCustomReminderDto,
} from '../dto/custom-reminder.dto';

// An id that isn't a UUID can't be anyone's reminder: 404, like an unknown one.
const ReminderId = () =>
  Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 }));

@Controller('reminders/custom')
export class CustomRemindersController {
  constructor(
    @Inject(CUSTOM_REMINDER_SERVICE)
    private readonly service: ICustomReminderService,
  ) {}

  @Get()
  async list(
    @ForwardedUserId() userId: string,
    @Query() { from, to }: RangeQueryDto,
  ) {
    return (await this.service.list(userId, { from, to })).map(
      toCustomReminderInRangeResponse,
    );
  }

  // The add sheet's "Next" dates while it's being filled in; nothing is saved.
  @Get('preview')
  preview(@Query() q: PreviewQueryDto) {
    return {
      next: this.service.preview({
        hour: q.hour,
        minute: q.minute,
        repeat: q.repeat,
        calendar: q.calendar ?? 'gregorian',
        start: q.start,
      }),
    };
  }

  @Post()
  async create(
    @ForwardedUserId() userId: string,
    @Body() dto: CreateCustomReminderDto,
  ) {
    return toChangedResponse(
      await this.service.create(
        userId,
        {
          title: dto.title,
          hour: dto.hour,
          minute: dto.minute,
          repeat: dto.repeat,
          calendar: dto.calendar ?? 'gregorian',
          start: dto.start,
        },
        showingRange(dto),
      ),
    );
  }

  @Patch(':id')
  async update(
    @ForwardedUserId() userId: string,
    @ReminderId() id: string,
    @Body() dto: UpdateCustomReminderDto,
  ) {
    const { from, to, ...fields } = dto;
    const patch = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );
    return toChangedResponse(
      await this.service.update(userId, id, patch, showingRange({ from, to })),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @ForwardedUserId() userId: string,
    @ReminderId() id: string,
  ): Promise<void> {
    await this.service.remove(userId, id);
  }

  @Post(':id/skip')
  @HttpCode(200)
  async skip(
    @ForwardedUserId() userId: string,
    @ReminderId() id: string,
    @Body() dto: SkipDto,
  ) {
    return toChangedResponse(
      await this.service.skip(userId, id, dto.date, showingRange(dto)),
    );
  }
}
