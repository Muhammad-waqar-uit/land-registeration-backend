import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../common/services/email.service';
import { ContactDto } from './dto/contact.dto';
import { ContactResponseDto } from './dto/contact-response.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private emailService: EmailService) {}

  async submitContactForm(contactDto: ContactDto): Promise<ContactResponseDto> {
    try {
      await this.emailService.sendContactEmail(
        contactDto.name,
        contactDto.email,
        contactDto.message,
      );

      this.logger.log(
        `Contact form submitted by ${contactDto.name} (${contactDto.email})`,
      );

      return {
        message: 'Contact form submitted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to send contact email:', error);
      throw error;
    }
  }
}
