import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePropertyRequestDto {
  @ApiProperty({
    description: 'Property/Land ID',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({
    description:
      "Buyer's offer price (optional, if different from listed price)",
    example: 245000.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  requestedPrice?: number;
}
