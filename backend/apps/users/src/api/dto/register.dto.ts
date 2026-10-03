import { IsEmail, IsString, MinLength } from 'class-validator';
import { ProfileDetailsDto } from './profile.dto';

export class RegisterDto extends ProfileDetailsDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
