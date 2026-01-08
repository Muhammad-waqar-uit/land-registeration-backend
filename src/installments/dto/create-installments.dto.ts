import { IsUUID, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInstallmentsDto {
  @ApiProperty({
    description: 'Agreement ID (installments are created from signed agreement)',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  agreementId: string;

  @ApiProperty({
    description: 'Number of installments (optional, defaults based on plan years)',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfInstallments?: number;
}

