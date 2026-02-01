import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveProjectDto {
  @ApiProperty({
    description: 'Optional approval notes (admin-only)',
    required: false,
    maxLength: 2000,
    example: 'Reviewed documents and verified compliance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalNotes?: string;
}
