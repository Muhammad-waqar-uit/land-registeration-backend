import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TokensService } from './tokens.service';
import { GetBalanceDto } from './dto/get-balance.dto';
import { MintTokenDto } from './dto/mint-token.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';
import { MintTokenResponseDto } from './dto/mint-response.dto';

@ApiTags('Tokens', 'ERC20')
@Controller('tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get ERC20 token balance for a user address' })
  @ApiQuery({
    name: 'address',
    description: 'User wallet address to check balance for',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BalanceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid address format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBalance(
    @Query() getBalanceDto: GetBalanceDto,
  ): Promise<BalanceResponseDto> {
    return this.tokensService.getBalance(getBalanceDto);
  }

  @Post('mint')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mint ERC20 tokens to a specific address (Admin only)',
    description:
      'Mints new tokens to the specified address. Only admins can perform this operation.',
  })
  @ApiBody({
    type: MintTokenDto,
    description: 'Mint token request',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens minted successfully',
    type: MintTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin only',
  })
  async mintToken(
    @Body() mintTokenDto: MintTokenDto,
  ): Promise<MintTokenResponseDto> {
    return this.tokensService.mintToken(mintTokenDto);
  }
}
