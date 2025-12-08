import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Get email configuration from environment variables
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const emailPort = this.configService.get<number>('EMAIL_PORT');
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');

    // If email is not configured, use console logging (development mode)
    if (!emailHost || !emailUser || !emailPassword) {
      this.logger.warn(
        'Email service not configured. Email will be logged to console only.',
      );
      this.logger.warn(
        'Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM in .env',
      );
      return;
    }

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort || 587,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.logger.log('Email service initialized');
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const subject = 'Password Reset Request';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #666;
              font-size: 12px;
            }
            .token {
              background-color: #e8e8e8;
              padding: 10px;
              border-radius: 5px;
              font-family: monospace;
              word-break: break-all;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to reset your password for your Land Registration account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <div class="token">${resetLink}</div>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request this password reset, please ignore this email.</p>
              <p>Best regards,<br>Land Registration Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset Request

You requested to reset your password for your Land Registration account.

Click this link to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email.

Best regards,
Land Registration Team
    `;

    await this.sendEmail(email, subject, html, text);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const emailFrom =
      this.configService.get<string>('EMAIL_FROM') ||
      this.configService.get<string>('EMAIL_USER') ||
      'noreply@landregister.com';

    // If email service is not configured, log to console
    if (!this.transporter) {
      this.logger.log('='.repeat(60));
      this.logger.log('📧 EMAIL (Not Sent - Email Service Not Configured)');
      this.logger.log('='.repeat(60));
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`From: ${emailFrom}`);
      this.logger.log('');
      this.logger.log('Content:');
      this.logger.log(text);
      this.logger.log('='.repeat(60));
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        text,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
      this.logger.debug(`Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw new Error(`Failed to send email: ${(error as Error).message}`);
    }
  }

  // Test email configuration
  async testEmailConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('Email service connection verified');
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed:', error);
      return false;
    }
  }
}
