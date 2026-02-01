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
import { PropertyRequestStatus } from '../entities/property-request.entity';

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
  @ApiResponse({
    status: 400,
    description: 'Property not eligible for requests',
  })
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
  @ApiOperation({ summary: "Get buyer's own property requests" })
  @ApiResponse({
    status: 200,
    description: "List of buyer's property requests",
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
  @ApiOperation({
    summary: "Get builder's pending property requests (Builder only) ✅",
    description:
      "Get only pending property requests for builder's properties. For all statuses, use /builder/all endpoint.",
  })
  @ApiResponse({
    status: 200,
    description: "List of pending property requests for builder's properties",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/PropertyRequestResponseDto' },
        },
        total: { type: 'number', example: 5 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
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

  @Get('builder/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary:
      "Get all property requests for builder's properties (Builder only) ✅",
    description:
      "Get all property requests (pending, approved, rejected, cancelled) for builder's properties. Supports status filtering via query parameter.",
  })
  @ApiResponse({
    status: 200,
    description:
      "List of all property requests for builder's properties with buyer and property details",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/PropertyRequestResponseDto' },
        },
        total: { type: 'number', example: 20 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findBuilderAllRequests(
    @Query() query: QueryPropertyRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.propertyRequestsService.findBuilderRequests(user.id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get property request by ID ✅',
    description:
      'Get a single property request by ID. Returns buyer and property details populated.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Property request details with buyer and property information populated',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid' },
        propertyId: { type: 'string', example: 'uuid' },
        buyerId: { type: 'string', example: 'uuid' },
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'cancelled'],
        },
        requestedPrice: { type: 'number', example: 240000.0, nullable: true },
        builderResponse: { type: 'string', nullable: true },
        respondedAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        buyer: {
          type: 'object',
          description: 'Buyer information (REQUIRED - populated)',
          properties: {
            id: { type: 'string', example: 'uuid' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' },
            walletAddress: {
              type: 'string',
              example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
              nullable: true,
            },
          },
        },
        property: {
          type: 'object',
          description: 'Property information (REQUIRED - populated)',
          properties: {
            id: { type: 'string', example: 'uuid' },
            title: {
              type: 'string',
              example: 'Beachfront Property Unit A-101',
            },
            location: { type: 'string', example: '123 Ocean Drive, Miami, FL' },
            price: { type: 'number', example: 250000.0 },
            size: { type: 'number', example: 500.5 },
            status: { type: 'string', example: 'reserved' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.findOne(id);
  }

  @Post(':id/respond')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: 'Respond to property request - Approve or Reject (Builder only)',
  })
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

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Approve property request (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Property request approved',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.respondToPropertyRequest(
      id,
      { status: PropertyRequestStatus.APPROVED },
      user.id,
    );
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Reject property request (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Property request rejected',
    type: PropertyRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Property request not found' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<PropertyRequestResponseDto> {
    return this.propertyRequestsService.respondToPropertyRequest(
      id,
      { status: PropertyRequestStatus.REJECTED },
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
