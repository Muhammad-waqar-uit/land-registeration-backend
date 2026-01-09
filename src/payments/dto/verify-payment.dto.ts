import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Whether payment is verified', example: true })
  @IsBoolean()
  verified: boolean;

  @ApiProperty({
    description: 'Remarks/notes',
    example: 'Payment verified successfully',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
