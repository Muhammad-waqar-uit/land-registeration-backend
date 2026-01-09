import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyRequestStatus } from '../../entities/property-request.entity';

export class RespondPropertyRequestDto {
  @ApiProperty({
    description: 'Response action',
    enum: PropertyRequestStatus,
    example: PropertyRequestStatus.APPROVED,
    enumName: 'PropertyRequestStatus',
  })
  @IsNotEmpty()
  @IsEnum(PropertyRequestStatus)
  status: PropertyRequestStatus;

  @ApiProperty({
    description: 'Optional response message/notes from builder',
    example: 'Approved. Please proceed with the agreement.',
    required: false,
  })
  @IsOptional()
  @IsString()
  builderResponse?: string;
}
