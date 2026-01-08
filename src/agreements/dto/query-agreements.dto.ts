import { IsOptional, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementType, AgreementStatus } from '../../entities/agreement.entity';

export class QueryAgreementsDto {
  @ApiProperty({
    description: 'Filter by agreement type',
    enum: AgreementType,
    required: false,
  })
  @IsOptional()
  @IsEnum(AgreementType)
  agreementType?: AgreementType;

  @ApiProperty({
    description: 'Filter by agreement status',
    enum: AgreementStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;

  @ApiProperty({
    description: 'Filter by property ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiProperty({
    description: 'Filter by buyer ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @ApiProperty({
    description: 'Filter by builder ID',
    example: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  builderId?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

