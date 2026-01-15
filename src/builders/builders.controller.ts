import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BuildersService } from './builders.service';
import { BuilderResponseDto } from './dto/builder-response.dto';
import { VerifyBuilderDto } from './dto/verify-builder.dto';
import { RegisterBuilderDto } from './dto/register-builder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User, UserRole } from '../entities/user.entity';
import { QueryPropertyRequestsDto } from '../property-requests/dto/query-property-requests.dto';
import { ProjectResponseDto } from '../projects/dto/project-response.dto';

@ApiTags('Builders')
@Controller('builders')
export class BuildersController {
  constructor(private readonly buildersService: BuildersService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Register as builder (requires admin verification) ✅',
    description:
      'Allows any authenticated user to request builder status by providing company information. Requires admin verification before they can operate as a builder.',
  })
  @ApiResponse({
    status: 201,
    description: 'Builder registration successful (pending admin verification)',
    type: BuilderResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'License number already registered',
  })
  async registerBuilder(
    @CurrentUser() user: User,
    @Body() registerDto: RegisterBuilderDto,
  ): Promise<BuilderResponseDto> {
    return this.buildersService.registerBuilder(user.id, registerDto);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify a builder (Admin only) ✅' })
  @ApiParam({ name: 'id', description: 'Builder ID' })
  @ApiResponse({
    status: 200,
    description: 'Builder successfully verified',
    type: BuilderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Builder not found' })
  @ApiResponse({
    status: 400,
    description: 'Builder already verified or not a builder',
  })
  async verifyBuilder(
    @Param('id') builderId: string,
    @CurrentUser() admin: User,
    @Body() verifyDto?: VerifyBuilderDto,
  ): Promise<BuilderResponseDto> {
    return this.buildersService.verifyBuilder(builderId, admin.id, verifyDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all builders ✅' })
  @ApiQuery({
    name: 'verifiedOnly',
    required: false,
    type: Boolean,
    description: 'Show only verified builders',
  })
  @ApiResponse({
    status: 200,
    description: 'List of builders',
    type: [BuilderResponseDto],
  })
  async findAll(
    @Query('verifiedOnly') verifiedOnly?: string,
  ): Promise<BuilderResponseDto[]> {
    const verified = verifiedOnly === 'true';
    return this.buildersService.findAll(verified);
  }

  // All /me routes must come before /:id route
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current builder profile (shorthand) ✅' })
  @ApiResponse({
    status: 200,
    description: 'Current builder profile',
    type: BuilderResponseDto,
  })
  async getMe(@CurrentUser() user: User): Promise<BuilderResponseDto> {
    return this.buildersService.getCurrentBuilder(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update builder profile (shorthand) ✅' })
  @ApiResponse({
    status: 200,
    description: 'Builder profile updated',
    type: BuilderResponseDto,
  })
  async updateMe(
    @CurrentUser() user: User,
    @Body()
    updateData: {
      name?: string;
      email?: string;
      companyName?: string;
      licenseNumber?: string;
      cnic?: string;
      fatherName?: string;
      phoneNumber?: string;
    },
  ): Promise<BuilderResponseDto> {
    return this.buildersService.updateProfile(user.id, updateData);
  }

  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current builder profile ✅' })
  @ApiResponse({
    status: 200,
    description: 'Current builder profile',
    type: BuilderResponseDto,
  })
  async getCurrentBuilder(
    @CurrentUser() user: User,
  ): Promise<BuilderResponseDto> {
    return this.buildersService.getCurrentBuilder(user.id);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update builder profile ✅' })
  @ApiResponse({
    status: 200,
    description: 'Builder profile updated',
    type: BuilderResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body()
    updateData: {
      name?: string;
      email?: string;
      companyName?: string;
      licenseNumber?: string;
      cnic?: string;
      fatherName?: string;
      phoneNumber?: string;
    },
  ): Promise<BuilderResponseDto> {
    return this.buildersService.updateProfile(user.id, updateData);
  }

  @Get('me/projects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get builder's projects ✅" })
  @ApiResponse({
    status: 200,
    description: "List of builder's projects",
    type: [ProjectResponseDto],
  })
  async getBuilderProjects(@CurrentUser() user: User) {
    return this.buildersService.getBuilderProjects(user.id);
  }

  @Get('me/properties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get builder's properties ✅" })
  @ApiResponse({
    status: 200,
    description: "List of builder's properties",
  })
  async getBuilderProperties(@CurrentUser() user: User) {
    return this.buildersService.getBuilderProperties(user.id);
  }

  @Get('me/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get builder's dashboard statistics ✅" })
  @ApiResponse({
    status: 200,
    description: 'Builder dashboard stats',
  })
  async getDashboardStats(@CurrentUser() user: User) {
    return this.buildersService.getDashboardStats(user.id);
  }

  @Get('me/requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get all property requests for builder's properties ✅",
    description:
      'Returns all property purchase requests (all statuses) for properties owned by the builder',
  })
  @ApiResponse({
    status: 200,
    description: 'List of property requests',
  })
  async getBuilderRequests(
    @CurrentUser() user: User,
    @Query() query: QueryPropertyRequestsDto,
  ) {
    return this.buildersService.getBuilderPropertyRequests(user.id, query);
  }

  // This must come after all /me routes
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get builder by ID ✅' })
  @ApiParam({ name: 'id', description: 'Builder ID' })
  @ApiResponse({
    status: 200,
    description: 'Builder details',
    type: BuilderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Builder not found' })
  async findOne(@Param('id') id: string): Promise<BuilderResponseDto> {
    return this.buildersService.findOne(id);
  }
}
