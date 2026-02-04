import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransferRequestDto {
  @ApiProperty({
    description: 'New owner (buyer) ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  newOwnerId: string;

  @ApiProperty({
    description: "Seller's notes or approval message",
    example: 'I approve the transfer of this property to the new owner',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
