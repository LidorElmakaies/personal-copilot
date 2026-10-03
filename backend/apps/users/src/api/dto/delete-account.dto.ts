import { IsEmail, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsEmail()
  email!: string;

  @IsString()
  currentPassword!: string;
}
