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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Builders')
@Controller('builders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class BuildersController {
  constructor(private readonly buildersService: BuildersService) {}

  @Post(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify a builder (Admin only)' })
  @ApiParam({ name: 'id', description: 'Builder ID' })
  @ApiResponse({
    status: 200,
    description: 'Builder successfully verified',
    type: BuilderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Builder not found' })
  @ApiResponse({ status: 400, description: 'Builder already verified or not a builder' })
  async verifyBuilder(
    @Param('id') builderId: string,
    @CurrentUser() admin: User,
    @Body() verifyDto?: VerifyBuilderDto,
  ): Promise<BuilderResponseDto> {
    return this.buildersService.verifyBuilder(builderId, admin.id, verifyDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all builders' })
  @ApiQuery({ name: 'verifiedOnly', required: false, type: Boolean, description: 'Show only verified builders' })
  @ApiResponse({
    status: 200,
    description: 'List of builders',
    type: [BuilderResponseDto],
  })
  async findAll(@Query('verifiedOnly') verifiedOnly?: string): Promise<BuilderResponseDto[]> {
    const verified = verifiedOnly === 'true';
    return this.buildersService.findAll(verified);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get builder by ID' })
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

  @Get('me/profile')
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Get current builder profile' })
  @ApiResponse({
    status: 200,
    description: 'Current builder profile',
    type: BuilderResponseDto,
  })
  async getCurrentBuilder(@CurrentUser() user: User): Promise<BuilderResponseDto> {
    return this.buildersService.getCurrentBuilder(user.id);
  }

  @Patch('me/profile')
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Update builder profile' })
  @ApiResponse({
    status: 200,
    description: 'Builder profile updated',
    type: BuilderResponseDto,
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateData: {
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
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: "Get builder's projects" })
  @ApiResponse({
    status: 200,
    description: "List of builder's projects",
  })
  async getBuilderProjects(@CurrentUser() user: User) {
    return this.buildersService.getBuilderProjects(user.id);
  }

  @Get('me/properties')
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: "Get builder's properties" })
  @ApiResponse({
    status: 200,
    description: "List of builder's properties",
  })
  async getBuilderProperties(@CurrentUser() user: User) {
    return this.buildersService.getBuilderProperties(user.id);
  }

  @Get('me/dashboard')
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: "Get builder's dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: 'Builder dashboard stats',
  })
  async getDashboardStats(@CurrentUser() user: User) {
    return this.buildersService.getDashboardStats(user.id);
  }
}

