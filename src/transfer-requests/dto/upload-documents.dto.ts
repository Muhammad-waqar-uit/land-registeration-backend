import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadDocumentsDto {
  @ApiProperty({
    description: "Builder's notes about the uploaded documents",
    example: 'All transfer documents uploaded and verified',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  builderNotes?: string;
}
