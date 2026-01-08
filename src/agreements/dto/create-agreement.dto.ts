import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AgreementType } from '../../entities/agreement.entity';

class AgreementTermsDto {
  @ApiProperty({
    description: 'Property price',
    example: 250000.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @ApiProperty({
    description: 'Total amount',
    example: 250000.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  totalAmount?: number;

  @ApiProperty({
    description: 'Installment plan duration in years',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  installmentPlanYears?: number;

  @ApiProperty({
    description: 'Payment terms description',
    example: 'Payable in 3 years with monthly installments',
    required: false,
  })
  @IsOptional()
  paymentTerms?: string;

  @ApiProperty({
    description: 'Additional property details',
    required: false,
  })
  @IsOptional()
  @IsObject()
  propertyDetails?: Record<string, any>;
}

export class CreateAgreementDto {
  @ApiProperty({
    description: 'Property/Land ID',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({
    description: 'Buyer ID',
    example: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  buyerId: string;

  @ApiProperty({
    description: 'Agreement type',
    enum: AgreementType,
    example: AgreementType.INITIAL,
  })
  @IsNotEmpty()
  @IsEnum(AgreementType)
  agreementType: AgreementType;

  @ApiProperty({
    description: 'Agreement terms and details',
    type: AgreementTermsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgreementTermsDto)
  terms?: AgreementTermsDto;
}

