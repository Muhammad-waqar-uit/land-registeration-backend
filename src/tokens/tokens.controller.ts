import {
  Controller,
  Post,
  Body,
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

@ApiTags('Tokens', 'ERC20')
@Controller('tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

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
