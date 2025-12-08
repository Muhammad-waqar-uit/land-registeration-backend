import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ description: 'Land ID to reserve', example: 'uuid' })
  @IsUUID()
  landId: string;
}
