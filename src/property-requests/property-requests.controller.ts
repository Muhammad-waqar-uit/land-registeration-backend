import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { PropertyRequestsService } from './property-requests.service';
import { CreatePropertyRequestDto } from './dto/create-property-request.dto';
import { RespondPropertyRequestDto } from './dto/respond-property-request.dto';
import { QueryPropertyRequestsDto } from './dto/query-property-requests.dto';
import { PropertyRequestResponseDto } from './dto/property-request-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Property Requests')
@Controller('property-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PropertyRequestsController {
  constructor(
    private readonly propertyRequestsService: PropertyRequestsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a property purchase request (Buyer)' })
  @ApiResponse({
    status: 201,
    description: 'Property request successfully created',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Property not eligible for requests' })
  @ApiResponse({ status: 409, description: 'Pending request already exists' })
  create(
    @Body() createDto: CreatePropertyRequestDto,
    @CurrentUser() user: User,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.createPropertyRequest(
      createDto,
      user.id,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all property requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of property requests',
    type: [PropertyRequestResponseDto],
  })
  findAll(@Query() query: QueryPropertyRequestsDto) {
    return this.propertyRequestsService.findAll(query);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Get buyer\'s own property requests' })
  @ApiResponse({
    status: 200,
    description: 'List of buyer\'s property requests',
    type: [PropertyRequestResponseDto],
  })
  findMyRequests(
    @Query() query: QueryPropertyRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.propertyRequestsService.findBuyerRequests(user.id, query);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Get builder\'s pending property requests (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'List of pending property requests for builder\'s properties',
    type: [PropertyRequestResponseDto],
  })
  findPendingRequests(
    @Query() query: QueryPropertyRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.propertyRequestsService.findBuilderPendingRequests(
      user.id,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Property request details',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.findOne(id);
  }

  @Post(':id/respond')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Respond to property request - Approve or Reject (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Property request successfully responded to',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() respondDto: RespondPropertyRequestDto,
    @CurrentUser() user: User,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.respondToPropertyRequest(
      id,
      respondDto,
      user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel property request (Buyer only)' })
  @ApiResponse({
    status: 200,
    description: 'Property request successfully cancelled',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.cancelPropertyRequest(id, user.id);
  }
}

