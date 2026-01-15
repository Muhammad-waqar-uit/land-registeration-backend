import { ApiProperty } from '@nestjs/swagger';

export class MintTokenResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Blockchain transaction hash',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    required: false,
  })
  transactionHash?: string;

  @ApiProperty({
    description: 'Error message if operation failed',
    example: null,
    required: false,
  })
  error?: string;
}
