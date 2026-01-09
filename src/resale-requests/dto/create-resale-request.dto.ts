import { IsUUID, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResaleRequestDto {
  @ApiProperty({
    description: 'Property/Land ID to resell',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({
    description: 'Asking price for resale',
    example: 280000.0,
    minimum: 0.01,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  requestedPrice: number;
}
