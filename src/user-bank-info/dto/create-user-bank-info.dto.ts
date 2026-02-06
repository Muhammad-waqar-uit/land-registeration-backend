import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserBankInfoDto {
  @ApiProperty({ description: 'Bank name', example: 'HBL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankName: string;

  @ApiProperty({ description: 'Account number', example: '12345678901234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  accountNumber: string;
}
