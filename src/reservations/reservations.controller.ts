import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

/**
 * @deprecated This controller is deprecated. Use PropertyRequestsController instead.
 * Reservations are being replaced by Property Requests in the builder-centric model.
 * This controller is kept for backward compatibility during migration.
 */
@ApiTags('Reservations', 'Deprecated')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({
    summary: '[DEPRECATED] Create a land reservation - Use Property Requests instead',
    deprecated: true,
  })
  @ApiResponse({
    status: 201,
    description: 'Reservation successfully created',
    type: ReservationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - User only' })
  @ApiResponse({ status: 404, description: 'Land not found' })
  @ApiResponse({ status: 409, description: 'Land not available or already reserved' })
  create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser() user: User,
  ) {
    return this.reservationsService.create(createReservationDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: '[DEPRECATED] Get all reservations - Use Property Requests instead',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'List of reservations',
    type: [ReservationResponseDto],
  })
  findAll(@CurrentUser() user: User) {
    // For buyers, only show their own reservations
    // For admins, show all
    const buyerId = user.role === UserRole.ADMIN ? undefined : user.id;
    return this.reservationsService.findAll(buyerId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER, UserRole.BUILDER)
  @ApiOperation({
    summary: '[DEPRECATED] Cancel a reservation - Use Property Requests instead',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Reservation successfully cancelled',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Reservation cancelled successfully' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner only' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.reservationsService.cancel(id, user.id).then(() => ({
      message: 'Reservation cancelled successfully',
    }));
  }
}
