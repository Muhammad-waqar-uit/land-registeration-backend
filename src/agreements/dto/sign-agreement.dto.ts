import { ApiProperty } from '@nestjs/swagger';

export class SignAgreementDto {
  @ApiProperty({
    description: 'Signature confirmation (user confirms they are signing)',
    example: true,
    default: true,
  })
  confirmed: boolean = true;
}

