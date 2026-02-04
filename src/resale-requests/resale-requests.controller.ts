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
import { ResaleRequestsService } from './resale-requests.service';
import { CreateResaleRequestDto } from './dto/create-resale-request.dto';
import { RespondResaleRequestDto } from './dto/respond-resale-request.dto';
import { QueryResaleRequestsDto } from './dto/query-resale-requests.dto';
import { ResaleRequestResponseDto } from './dto/resale-request-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';
import { ResaleRequestStatus } from '../entities/resale-request.entity';

@ApiTags('Resale Requests')
@Controller('resale-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ResaleRequestsController {
  constructor(private readonly resaleRequestsService: ResaleRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a resale request (Property Owner)' })
  @ApiResponse({
    status: 201,
    description: 'Resale request successfully created',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Property not eligible for resale' })
  @ApiResponse({ status: 409, description: 'Resale request already exists' })
  create(
    @Body() createDto: CreateResaleRequestDto,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.createResaleRequest(createDto, user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all resale requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of resale requests',
    type: [ResaleRequestResponseDto],
  })
  findAll(@Query() query: QueryResaleRequestsDto) {
    return this.resaleRequestsService.findAll(query);
  }

  @Get('my-requests')
  @ApiOperation({ summary: "Get property owner's own resale requests" })
  @ApiResponse({
    status: 200,
    description: "List of owner's resale requests",
    type: [ResaleRequestResponseDto],
  })
  findMyRequests(
    @Query() query: QueryResaleRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.resaleRequestsService.findOwnerResaleRequests(user.id, query);
  }

  @Get('builder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: "Get builder's resale requests (Builder only)" })
  @ApiResponse({
    status: 200,
    description: "List of resale requests for builder's properties",
    type: [ResaleRequestResponseDto],
  })
  findBuilderRequests(
    @Query() query: QueryResaleRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.resaleRequestsService.findBuilderResaleRequests(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resale request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Resale request details',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.findOne(id);
  }

  @Post(':id/respond')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: 'Respond to resale request - Approve or Reject (Builder only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Resale request successfully responded to',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() respondDto: RespondResaleRequestDto,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.respondToResaleRequest(
      id,
      respondDto,
      user.id,
    );
  }

  @Post(':id/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: 'List property as resale after approval (Builder only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Property successfully listed for resale',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Request must be approved first' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  listProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.listPropertyAsResale(id, user.id);
  }

  @Post(':id/list-as-seller')
  @ApiOperation({
    summary: 'List property as resale after approval (Property Owner/Seller)',
  })
  @ApiResponse({
    status: 200,
    description: 'Property successfully listed for resale by seller',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Request must be approved first' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  listPropertyAsSeller(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.listPropertyAsSeller(id, user.id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Approve resale request (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Resale request approved',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.respondToResaleRequest(
      id,
      { status: ResaleRequestStatus.APPROVED },
      user.id,
    );
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Reject resale request (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Resale request rejected',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.respondToResaleRequest(
      id,
      { status: ResaleRequestStatus.REJECTED },
      user.id,
    );
  }

  @Post(':id/mark-sold')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark resale property as sold (Builder or Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Property successfully marked as sold',
    type: ResaleRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Property must be listed first' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Resale request not found' })
  markSold(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ResaleRequestResponseDto> {
    return this.resaleRequestsService.markResaleAsSold(id, user.id, user.role);
  }
}
