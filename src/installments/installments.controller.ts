import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InstallmentsService } from './installments.service';
import { CreateInstallmentsDto } from './dto/create-installments.dto';
import { QueryInstallmentsDto } from './dto/query-installments.dto';
import { InstallmentResponseDto } from './dto/installment-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Installments')
@Controller('installments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: 'Create installments from signed agreement (Builder only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Installments successfully created',
    type: [InstallmentResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Agreement not signed or installments already exist',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only' })
  create(
    @Body() createDto: CreateInstallmentsDto,
    @CurrentUser() user: User,
  ): Promise<InstallmentResponseDto[]> {
    return this.installmentsService.createInstallmentsFromAgreement(
      createDto,
      user.id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all installments with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'List of installments',
    type: [InstallmentResponseDto],
  })
  findAll(@Query() query: QueryInstallmentsDto) {
    return this.installmentsService.findAll(query);
  }

  @Get('my-installments')
  @ApiOperation({ summary: "Get buyer's own installments" })
  @ApiResponse({
    status: 200,
    description: "List of buyer's installments",
    type: [InstallmentResponseDto],
  })
  findMyInstallments(
    @Query() query: QueryInstallmentsDto,
    @CurrentUser() user: User,
  ) {
    return this.installmentsService.findBuyerInstallments(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get installment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Installment details',
    type: InstallmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Installment not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstallmentResponseDto> {
    return this.installmentsService.findOne(id);
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get installment payment status and details',
  })
  @ApiResponse({
    status: 200,
    description: 'Installment status with payment information',
    schema: {
      type: 'object',
      properties: {
        installment: { type: 'object' },
        isPaid: { type: 'boolean' },
        hasPendingPayment: { type: 'boolean' },
        paymentStatus: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Installment not found' })
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.installmentsService.getInstallmentStatus(id);
  }

  @Post('update-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Update overdue installments (Admin only - typically called via cron)',
  })
  @ApiResponse({
    status: 200,
    description: 'Number of installments marked as overdue',
    schema: {
      type: 'object',
      properties: {
        updatedCount: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async updateOverdue() {
    const count = await this.installmentsService.updateOverdueInstallments();
    return {
      updatedCount: count,
      message: `${count} installment(s) marked as overdue`,
    };
  }
}
