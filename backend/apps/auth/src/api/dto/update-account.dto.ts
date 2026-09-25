import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// newEmail/newPassword are each optional, but the service rejects a request with neither set.
export class UpdateAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  currentPassword!: string;

  @IsOptional()
  @IsEmail()
  newEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
