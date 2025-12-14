import { ApiProperty } from '@nestjs/swagger';

class FileVerificationResult {
  @ApiProperty({
    description: 'Whether the file is verified as genuine',
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: 'Verification message',
    example: 'Document is genuine and has not been tampered with.',
  })
  message: string;

  @ApiProperty({
    description: 'Stored SHA-256 hash from database',
    example: 'a1b2c3d4e5f6...',
    required: false,
  })
  storedHash?: string;

  @ApiProperty({
    description: 'Calculated SHA-256 hash from stored file',
    example: 'a1b2c3d4e5f6...',
    required: false,
  })
  calculatedHash?: string;
}

export class VerificationResponseDto {
  @ApiProperty({
    description: 'Overall verification status (true if all files are verified)',
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: 'Overall verification message',
    example: 'All files verified successfully.',
  })
  message: string;

  @ApiProperty({
    description: 'Document verification result',
    type: FileVerificationResult,
    required: false,
  })
  document?: FileVerificationResult;

  @ApiProperty({
    description: 'Image verification result',
    type: FileVerificationResult,
    required: false,
  })
  image?: FileVerificationResult;
}
