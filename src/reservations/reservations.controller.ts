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

@ApiTags('Reservations')
@Controller('reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUYER)
  @ApiOperation({ summary: 'Create a land reservation' })
  @ApiResponse({
    status: 201,
    description: 'Reservation successfully created',
    type: ReservationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Buyer only' })
  @ApiResponse({ status: 404, description: 'Land not found' })
  @ApiResponse({ status: 409, description: 'Land not available or already reserved' })
  create(
    @Body() createReservationDto: CreateReservationDto,
    @CurrentUser() user: User,
  ) {
    return this.reservationsService.create(createReservationDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reservations (buyers see only their own, admins see all)' })
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
  @Roles(UserRole.BUYER)
  @ApiOperation({ summary: 'Cancel a reservation' })
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
