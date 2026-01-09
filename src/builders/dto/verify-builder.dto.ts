import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyBuilderDto {
  @ApiProperty({
    description: 'User ID of the builder to verify',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  builderId: string;

  @ApiProperty({
    description: 'Optional remarks about the verification',
    example: 'License verified, company documents checked',
    required: false,
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
