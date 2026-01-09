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

    // Trim whitespace from password (common issue: spaces in app passwords)
    const trimmedPassword = emailPassword.trim().replace(/\s+/g, '');

    // Log configuration (without showing password)
    this.logger.log('Email service configuration:');
    this.logger.log(`  Host: ${emailHost}`);
    this.logger.log(`  Port: ${emailPort || 587}`);
    this.logger.log(`  User: ${emailUser}`);
    this.logger.log(
      `  Password: ${trimmedPassword.length > 0 ? '***' + trimmedPassword.slice(-4) : 'NOT SET'}`,
    );

    // Warn if password had spaces
    if (emailPassword !== trimmedPassword) {
      this.logger.warn(
        '⚠️  Password had spaces/whitespace - they have been removed. Make sure your .env has no spaces in EMAIL_PASSWORD.',
      );
    }

    // Create transporter
    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort || 587,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser.trim(),
        pass: trimmedPassword,
      },
    });

    this.logger.log('Email service initialized');
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
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

  async sendContactEmail(
    name: string,
    email: string,
    message: string,
  ): Promise<void> {
    const emailFrom =
      this.configService.get<string>('EMAIL_FROM') ||
      this.configService.get<string>('EMAIL_USER') ||
      'noreply@landregister.com';

    // Send to the same address as FROM (as requested)
    const toEmail = emailFrom;

    const subject = `New Contact Form Submission from ${name}`;

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
            .field {
              margin-bottom: 20px;
            }
            .field-label {
              font-weight: bold;
              color: #555;
              margin-bottom: 5px;
            }
            .field-value {
              background-color: white;
              padding: 10px;
              border-radius: 4px;
              border-left: 4px solid #4CAF50;
            }
            .message-box {
              background-color: white;
              padding: 15px;
              border-radius: 4px;
              border-left: 4px solid #4CAF50;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Contact Form Submission</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label">Name:</div>
                <div class="field-value">${this.escapeHtml(name)}</div>
              </div>
              <div class="field">
                <div class="field-label">Email:</div>
                <div class="field-value">${this.escapeHtml(email)}</div>
              </div>
              <div class="field">
                <div class="field-label">Message:</div>
                <div class="message-box">${this.escapeHtml(message)}</div>
              </div>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              <p style="color: #777; font-size: 12px;">
                This email was sent from the contact form on your website.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
New Contact Form Submission

Name: ${name}
Email: ${email}

Message:
${message}

---
This email was sent from the contact form on your website.
    `;

    await this.sendEmail(toEmail, subject, html, text);
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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
      const info = (await this.transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        text,
        html,
      })) as { messageId: string };

      this.logger.log(`Email sent successfully to ${to}`);
      this.logger.debug(`Message ID: ${info.messageId}`);
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Failed to send email to ${to}:`, error);

      // Provide helpful error messages for common Gmail errors
      if (
        errorMessage.includes('Invalid login') ||
        errorMessage.includes('BadCredentials')
      ) {
        this.logger.error('');
        this.logger.error('🔴 GMAIL AUTHENTICATION ERROR');
        this.logger.error('Common causes:');
        this.logger.error(
          '  1. App password has spaces (remove all spaces from EMAIL_PASSWORD)',
        );
        this.logger.error(
          '  2. Using regular Gmail password instead of App Password',
        );
        this.logger.error('  3. 2-Step Verification not enabled');
        this.logger.error('  4. App password was revoked or expired');
        this.logger.error('');
        this.logger.error('See GMAIL_TROUBLESHOOTING.md for detailed help');
        this.logger.error('');
      }

      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }

  // Test email configuration
  async testEmailConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Email service not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('✅ Email service connection verified successfully');
      return true;
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error('❌ Email service connection failed:', errorMessage);

      // Provide helpful error messages
      if (
        errorMessage.includes('Invalid login') ||
        errorMessage.includes('BadCredentials')
      ) {
        this.logger.error('');
        this.logger.error('🔴 GMAIL AUTHENTICATION ERROR');
        this.logger.error('Fix: Check your EMAIL_PASSWORD in .env file');
        this.logger.error('   - Remove all spaces from app password');
        this.logger.error('   - Use App Password (not regular password)');
        this.logger.error('   - Ensure 2-Step Verification is enabled');
        this.logger.error('');
      }

      return false;
    }
  }
}
