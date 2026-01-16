import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignAgreementDto {
  @ApiProperty({
    description: 'Signature confirmation (user confirms they are signing)',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean = true;
}
