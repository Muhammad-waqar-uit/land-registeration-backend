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
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../entities/user.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { EmailService } from '../common/services/email.service';
import { WalletService } from '../common/services/wallet.service';
import { BlockchainService } from '../common/services/blockchain.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private walletService: WalletService,
    private blockchainService: BlockchainService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, companyName, licenseNumber, ...userData } =
      registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // If builder role, validate builder-specific fields
    if (registerDto.role === UserRole.BUILDER) {
      if (!companyName || !licenseNumber) {
        throw new BadRequestException(
          'Company name and license number are required for builder registration',
        );
      }

      // Check if license number already exists
      const existingLicense = await this.userRepository.findOne({
        where: { licenseNumber },
      });

      if (existingLicense) {
        throw new ConflictException('License number is already registered');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (temporarily to get ID for wallet generation)
    const user = this.userRepository.create({
      ...userData,
      email,
      password: hashedPassword,
      // Builder-specific fields
      companyName: registerDto.role === UserRole.BUILDER ? companyName : null,
      licenseNumber:
        registerDto.role === UserRole.BUILDER ? licenseNumber : null,
      // Builder is not verified by default
      isBuilderVerified: false,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate wallet address for user
    try {
      const { address } = this.walletService.generateWalletFromUserId(
        savedUser.id,
      );

      // Check if address already exists (shouldn't happen, but safety check)
      const existingUser = await this.userRepository.findOne({
        where: { walletAddress: address },
      });

      if (existingUser) {
        this.logger.warn(
          `Wallet address ${address} already exists, generating new one...`,
        );
        // Retry with a slight modification (shouldn't happen in practice)
        throw new Error('Wallet address collision');
      }

      savedUser.walletAddress = address;
      const userWithWallet = await this.userRepository.save(savedUser);
      this.logger.log(`Generated wallet ${address} for user ${savedUser.id}`);

      // Generate tokens
      const accessToken = this.generateAccessToken(userWithWallet);
      const refreshToken = await this.generateRefreshToken(userWithWallet.id);

      return {
        user: UserResponseDto.fromEntity(userWithWallet),
        token: accessToken, // Backward compatibility
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate wallet for user ${savedUser.id}:`,
        error,
      );
      // Continue without wallet - user can still be created
      // User can generate wallet later using /auth/wallet/generate endpoint

      // Generate tokens
      const accessToken = this.generateAccessToken(savedUser);
      const refreshToken = await this.generateRefreshToken(savedUser.id);

      return {
        user: UserResponseDto.fromEntity(savedUser),
        token: accessToken, // Backward compatibility
        accessToken,
        refreshToken,
      };
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user with password (using select: false in entity)
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.walletAddress')
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
        const { address } = this.walletService.generateWalletFromUserId(
          user.id,
        );

        // Check if address already exists
        const existingUser = await this.userRepository.findOne({
          where: { walletAddress: address },
        });

        if (existingUser && existingUser.id !== user.id) {
          this.logger.warn(
            `Wallet address ${address} already exists for another user`,
          );
          // Continue without wallet - user can generate later
        } else {
          user.walletAddress = address;
          const userWithWallet = await this.userRepository.save(user);
          this.logger.log(
            `Generated wallet ${address} for existing user ${user.id} on login`,
          );

          // Generate tokens
          const accessToken = this.generateAccessToken(userWithWallet);
          const refreshToken = await this.generateRefreshToken(
            userWithWallet.id,
          );

          return {
            user: UserResponseDto.fromEntity(userWithWallet),
            token: accessToken, // Backward compatibility
            accessToken,
            refreshToken,
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate wallet for user ${user.id} on login:`,
          error,
        );
        // Continue without wallet - user can still login
        // User can generate wallet later using /auth/wallet/generate endpoint
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user: UserResponseDto.fromEntity(user),
      token: accessToken, // Backward compatibility
      accessToken,
      refreshToken,
    };
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate wallet if missing
    if (!user.walletAddress) {
      try {
        const { address } = this.walletService.generateWalletFromUserId(
          user.id,
        );
        user.walletAddress = address;
        await this.userRepository.save(user);
        this.logger.log(
          `Generated wallet ${address} for user ${user.id} on getCurrentUser`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate wallet for user ${user.id}:`,
          error,
        );
        // Continue without wallet
      }
    }

    return UserResponseDto.fromEntity(user);
  }

  async generateWallet(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'name',
        'email',
        'role',
        'walletAddress',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate wallet address
    try {
      const { address } = this.walletService.generateWalletFromUserId(user.id);

      // Check if address already exists for another user
      const existingUser = await this.userRepository.findOne({
        where: { walletAddress: address },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException(
          'Wallet address already assigned to another user',
        );
      }

      user.walletAddress = address;
      const updatedUser = await this.userRepository.save(user);
      this.logger.log(`Generated wallet ${address} for user ${userId}`);

      return UserResponseDto.fromEntity(updatedUser);
    } catch (error) {
      this.logger.error(`Failed to generate wallet for user ${userId}:`, error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to generate wallet address. Please try again.',
      );
    }
  }

  async updateProfile(
    userId: string,
    updateProfileDto: {
      name?: string;
      email?: string;
      cnic?: string;
      fatherName?: string;
      phoneNumber?: string;
      companyName?: string;
      licenseNumber?: string;
    },
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

    // Check if license number is being updated (for builders) and if it's already taken
    if (
      updateProfileDto.licenseNumber &&
      updateProfileDto.licenseNumber !== user.licenseNumber
    ) {
      // Only check if user is a builder
      if (user.role === UserRole.BUILDER) {
        const existingLicense = await this.userRepository.findOne({
          where: { licenseNumber: updateProfileDto.licenseNumber },
        });

        if (existingLicense && existingLicense.id !== userId) {
          throw new ConflictException('License number is already registered');
        }
      }
    }

    // Update user fields
    if (updateProfileDto.name !== undefined) user.name = updateProfileDto.name;
    if (updateProfileDto.email !== undefined)
      user.email = updateProfileDto.email;
    if (updateProfileDto.cnic !== undefined) user.cnic = updateProfileDto.cnic;
    if (updateProfileDto.fatherName !== undefined)
      user.fatherName = updateProfileDto.fatherName;
    if (updateProfileDto.phoneNumber !== undefined)
      user.phoneNumber = updateProfileDto.phoneNumber;

    // Update builder-specific fields (only for builders)
    if (user.role === UserRole.BUILDER) {
      if (updateProfileDto.companyName !== undefined)
        user.companyName = updateProfileDto.companyName;
      if (updateProfileDto.licenseNumber !== undefined)
        user.licenseNumber = updateProfileDto.licenseNumber;
    }

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
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

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

  async forgotPassword(
    email: string,
  ): Promise<{ message: string; resetToken?: string }> {
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
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

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
        message:
          'If the email exists, a password reset link has been sent to your email.',
      };
    } catch (error) {
      // In development, return token if email service not configured
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.warn(
          'Email service not configured. Returning token in response (DEV ONLY).',
        );
        return {
          message:
            'Password reset token generated. Check your email for reset link.',
          resetToken: rawToken, // ⚠️ DEV ONLY - Remove in production!
        };
      }
      throw error;
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
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

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    // Hash the provided token to match stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Find token in database
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: hashedToken, revoked: false },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is expired
    if (tokenRecord.expiresAt < new Date()) {
      // Mark as revoked
      tokenRecord.revoked = true;
      await this.refreshTokenRepository.save(tokenRecord);
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Get user
    const user = await this.userRepository.findOne({
      where: { id: tokenRecord.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate new access token
    const accessToken = this.generateAccessToken(user);

    // Optionally rotate refresh token (for better security)
    const rotateRefreshToken =
      this.configService.get<string>('REFRESH_TOKEN_ROTATION') !== 'false';

    if (rotateRefreshToken) {
      // Revoke old token
      tokenRecord.revoked = true;
      await this.refreshTokenRepository.save(tokenRecord);

      // Generate new refresh token
      const newRefreshToken = await this.generateRefreshToken(user.id);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    }

    return {
      accessToken,
    };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: hashedToken },
    });

    if (tokenRecord) {
      tokenRecord.revoked = true;
      await this.refreshTokenRepository.save(tokenRecord);
    }
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );
  }

  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Access token expires in 15 minutes to 1 hour (short-lived)
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '1h';

    return this.jwtService.sign(payload, {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    // Generate random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Set expiry to 7-30 days (long-lived)
    const expiresInDays = parseInt(
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN_DAYS') || '7',
      10,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store token in database
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token: hashedToken,
      expiresAt,
      revoked: false,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // Clean up expired tokens
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    // Return raw token (only time it's visible)
    return rawToken;
  }

  /**
   * Verify a builder (Admin only)
   * This delegates to BuildersService but is also available through Auth for convenience
   */
  async verifyBuilder(
    builderId: string,
    adminId: string,
  ): Promise<UserResponseDto> {
    const builder = await this.userRepository.findOne({
      where: { id: builderId },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    if (builder.role !== UserRole.BUILDER) {
      throw new BadRequestException('User is not a builder');
    }

    if (builder.isBuilderVerified) {
      throw new BadRequestException('Builder is already verified');
    }

    // Verify the builder
    builder.isBuilderVerified = true;
    builder.builderVerifiedAt = new Date();
    builder.verifiedBy = adminId;

    const verifiedBuilder = await this.userRepository.save(builder);
    this.logger.log(`Builder ${builderId} verified by admin ${adminId}`);

    // Register builder on blockchain if wallet address exists and contract is available
    if (
      verifiedBuilder.walletAddress &&
      this.blockchainService.isContractAvailable()
    ) {
      try {
        if (verifiedBuilder.licenseNumber) {
          const blockchainResult = await this.blockchainService.registerBuilder(
            verifiedBuilder.walletAddress,
            verifiedBuilder.licenseNumber,
          );

          if (blockchainResult.success) {
            this.logger.log(
              `Builder ${builderId} registered on blockchain. TX: ${blockchainResult.transactionHash || 'N/A'}`,
            );
          } else {
            this.logger.warn(
              `Failed to register builder on blockchain: ${blockchainResult.error}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(`Error registering builder on blockchain: ${error}`);
        // Don't fail builder verification if blockchain registration fails
      }
    }

    return UserResponseDto.fromEntity(verifiedBuilder);
  }
}
