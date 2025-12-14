import { ApiProperty } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Contact form submitted successfully',
  })
  message: string;
}
