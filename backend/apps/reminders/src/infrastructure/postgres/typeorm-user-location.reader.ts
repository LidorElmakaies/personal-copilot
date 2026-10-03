import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Coordinates } from '../../models/user-location';
import type { IUserLocationReader } from '../interfaces/user-location-reader.interface';
import { UsersProfileEntity } from '@app/users-schema';

@Injectable()
export class TypeOrmUserLocationReader implements IUserLocationReader {
  constructor(
    @InjectRepository(UsersProfileEntity)
    private readonly profiles: Repository<UsersProfileEntity>,
  ) {}

  async findByUserId(userId: string): Promise<Coordinates | null> {
    const row = await this.profiles.findOneBy({ userId });
    if (!row || row.lat === null || row.lon === null || row.tz === null) {
      return null;
    }
    return { lat: row.lat, lon: row.lon, tz: row.tz };
  }
}
