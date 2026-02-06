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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { TokensService } from './tokens.service';
import { MintTokenDto } from './dto/mint-token.dto';
import { MintTokenResponseDto } from './dto/mint-response.dto';
import { GetBalanceDto } from './dto/get-balance.dto';
import { BalanceResponseDto } from './dto/balance-response.dto';

@ApiTags('Tokens', 'Points')
@Controller('tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Get points balance for a wallet address',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
    type: BalanceResponseDto,
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
    summary: 'Mint points to a specific address (Admin only)',
    description:
      'Mints new points to the specified address in the LandLedgerLite contract. Only admins can perform this operation.',
  })
  @ApiBody({
    type: MintTokenDto,
    description: 'Mint token request',
  })
  @ApiResponse({
    status: 200,
    description: 'Points minted successfully',
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
