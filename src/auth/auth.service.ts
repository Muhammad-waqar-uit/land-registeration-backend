import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../entities/user.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { jwtConfig } from '../config/jwt.config';
import { EmailService } from '../common/services/email.service';
import { WalletService } from '../common/services/wallet.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepository: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private walletService: WalletService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, ...userData } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (temporarily to get ID for wallet generation)
    const user = this.userRepository.create({
      ...userData,
      email,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate wallet address for user
    try {
      const { address } = this.walletService.generateWalletFromUserId(savedUser.id);
      savedUser.walletAddress = address;
      const userWithWallet = await this.userRepository.save(savedUser);
      this.logger.log(`Generated wallet ${address} for user ${savedUser.id}`);

      // Generate JWT token
      const token = this.generateToken(userWithWallet);

      return {
        user: UserResponseDto.fromEntity(userWithWallet),
        token,
      };
    } catch (error) {
      this.logger.error(`Failed to generate wallet for user ${savedUser.id}:`, error);
      // Continue without wallet - user can still be created
      
      // Generate JWT token
      const token = this.generateToken(savedUser);

      return {
        user: UserResponseDto.fromEntity(savedUser),
        token,
      };
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user with password (using select: false in entity)
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate wallet if user doesn't have one (for old accounts)
    if (!user.walletAddress) {
      try {
        const { address } = this.walletService.generateWalletFromUserId(user.id);
        user.walletAddress = address;
        const userWithWallet = await this.userRepository.save(user);
        this.logger.log(`Generated wallet ${address} for existing user ${user.id} on login`);
        
        // Generate JWT token
        const token = this.generateToken(userWithWallet);

        return {
          user: UserResponseDto.fromEntity(userWithWallet),
          token,
        };
      } catch (error) {
        this.logger.error(`Failed to generate wallet for user ${user.id} on login:`, error);
        // Continue without wallet - user can still login
      }
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      user: UserResponseDto.fromEntity(user),
      token,
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return UserResponseDto.fromEntity(user);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: { name?: string; email?: string },
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if email is being updated and if it's already taken
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateProfileDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email is already taken');
      }
    }

    // Update user fields
    if (updateProfileDto.name !== undefined) user.name = updateProfileDto.name;
    if (updateProfileDto.email !== undefined) user.email = updateProfileDto.email;

    const updatedUser = await this.userRepository.save(user);

    return UserResponseDto.fromEntity(updatedUser);
  }

  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Find user with password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return {
      message: 'Password updated successfully',
    };
  }

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Invalidate any existing tokens for this user
    await this.resetTokenRepository.update(
      { userId: user.id, used: false },
      { used: true },
    );

    // Generate reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Set expiry to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store token in database
    const resetToken = this.resetTokenRepository.create({
      userId: user.id,
      token: hashedToken,
      expiresAt,
      used: false,
    });

    await this.resetTokenRepository.save(resetToken);

    // Send email with reset link
    try {
      await this.emailService.sendPasswordResetEmail(email, rawToken);
      return {
        message: 'If the email exists, a password reset link has been sent to your email.',
      };
    } catch (error) {
      // In development, return token if email service not configured
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.warn('Email service not configured. Returning token in response (DEV ONLY).');
        return {
          message: 'Password reset token generated. Check your email for reset link.',
          resetToken: rawToken, // ⚠️ DEV ONLY - Remove in production!
        };
      }
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Hash the provided token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find token in database
    const resetToken = await this.resetTokenRepository.findOne({
      where: { token: hashedToken, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      // Mark as used even though expired
      resetToken.used = true;
      await this.resetTokenRepository.save(resetToken);
      throw new BadRequestException('Reset token has expired');
    }

    // Find user
    const user = await this.userRepository.findOne({
      where: { id: resetToken.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Mark token as used
    resetToken.used = true;
    await this.resetTokenRepository.save(resetToken);

    // Clean up expired tokens (optional - can be done via cron job)
    await this.resetTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return {
      message: 'Password reset successfully',
    };
  }

  // Admin function to reset password directly (for recovery)
  async adminResetPassword(
    userId: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    return {
      message: 'Password reset successfully',
    };
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || jwtConfig.expiresIn;
    
    return this.jwtService.sign(payload, {
      expiresIn: expiresIn as any,
    });
  }
}
