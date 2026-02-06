import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BuyersService } from './buyers.service';
import { QueryBuyerProgressDto } from './dto/query-buyer-progress.dto';
import { BuyerProgressResponseDto } from './dto/buyer-progress-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Buyers')
@Controller('buyers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get('me/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER, UserRole.BUILDER)
  @ApiOperation({ summary: 'Get buyer dashboard stats' })
  @ApiResponse({
    status: 200,
    description: 'Buyer dashboard stats',
    schema: {
      type: 'object',
      properties: {
        totalPaid: { type: 'number', example: 500000 },
        pendingPayments: { type: 'number', example: 2 },
        pendingRequests: { type: 'number', example: 1 },
        pendingAgreements: { type: 'number', example: 1 },
        upcomingInstallments: { type: 'number', example: 3 },
        ownedProperties: { type: 'number', example: 2 },
      },
    },
  })
  getBuyerStats(@CurrentUser() user: User) {
    return this.buyersService.getBuyerStats(user.id);
  }

  @Get('progress')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Get buyer progress tracking for builder's properties ✅",
    description:
      'Returns aggregated buyer progress data for all buyers who have made payments or reservations on properties owned by the authenticated builder/seller. Includes payment statistics, agreement status, progress tracking, per-status stats, and per-project stats. Supports filtering by status, project, land, or buyer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Buyer progress data retrieved successfully',
    type: BuyerProgressResponseDto,
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only builders and sellers can access buyer progress',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getBuyerProgress(
    @Query() query: QueryBuyerProgressDto,
    @CurrentUser() user: User,
  ): Promise<BuyerProgressResponseDto> {
    return this.buyersService.getBuyerProgress(user.id, query);
  }
}
