import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResaleRequestStatus } from '../../entities/resale-request.entity';

export class RespondResaleRequestDto {
  @ApiProperty({
    description: 'Response action - APPROVED or REJECTED',
    enum: ResaleRequestStatus,
    example: ResaleRequestStatus.APPROVED,
    enumName: 'ResaleRequestStatus',
  })
  @IsNotEmpty()
  @IsEnum(ResaleRequestStatus, {
    message: 'Status must be either APPROVED or REJECTED',
  })
  status: ResaleRequestStatus;
}
