import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';
import { ContactResponseDto } from './dto/contact-response.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send contact form message via email' })
  @ApiBody({
    type: ContactDto,
    description: 'Contact form data',
    examples: {
      example1: {
        value: {
          name: 'John Doe',
          email: 'user@example.com',
          message: 'Hello, I would like to inquire about...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Contact form submitted successfully',
    type: ContactResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send email',
  })
  async submitContactForm(
    @Body() contactDto: ContactDto,
  ): Promise<ContactResponseDto> {
    return this.contactService.submitContactForm(contactDto);
  }
}
