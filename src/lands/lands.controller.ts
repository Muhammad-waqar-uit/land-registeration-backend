import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { LandsService } from './lands.service';
import { CreateLandDto } from './dto/create-land.dto';
import { UpdateLandDto } from './dto/update-land.dto';
import { QueryLandsDto } from './dto/query-lands.dto';
import { LandResponseDto } from './dto/land-response.dto';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Properties', 'Lands')
@Controller(['properties', 'lands']) // Support both routes for backward compatibility
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class LandsController {
  constructor(private readonly landsService: LandsService) {}

  @Get()
  @ApiOperation({
    summary: 'List properties (with filters: project, builder, status, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of properties',
    type: [LandResponseDto],
  })
  findAll(@Query() query: QueryLandsDto) {
    return this.landsService.findAll(query);
  }

  @Get('my-properties')
  @ApiOperation({
    summary: "Get buyer's owned properties ✅",
    description:
      "Get all properties owned by the authenticated buyer. Automatically filters by current user's ID and status 'owned'.",
  })
  @ApiResponse({
    status: 200,
    description: "List of buyer's owned properties",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/LandResponseDto' },
        },
        total: { type: 'number', example: 5 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyProperties(@Query() query: QueryLandsDto, @CurrentUser() user: User) {
    return this.landsService.findMyProperties(query, user.id);
  }

  @Get('builder/my-lands')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({
    summary: "Get builder's properties (full details) ✅",
    description:
      "Get all properties owned by the authenticated builder (for dashboard). Returns project, builder, owner, unitId, agreementId, installments, documents, etc.",
  })
  @ApiResponse({
    status: 200,
    description: "Builder's properties with full details",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/LandResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only' })
  getMyBuilderLands(@Query() query: QueryLandsDto, @CurrentUser() user: User) {
    return this.landsService.findMyBuilderLands(query, user.id);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all lands/properties (Admin only) ✅',
    description:
      'Retrieve all lands/properties in the system. Supports pagination with limit and offset, and various filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all lands/properties',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/LandResponseDto' },
        },
        total: { type: 'number', example: 200 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAllLands(@Query() query: QueryLandsDto) {
    return this.landsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property details' })
  @ApiResponse({
    status: 200,
    description: 'Property details',
    type: LandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.landsService.findOne(id, true);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER) // Only builders can create properties
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'document', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create property (builder only, within project)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Beachfront Property' },
        location: { type: 'string', example: '123 Ocean Drive, Miami' },
        size: { type: 'number', example: 500.5 },
        price: { type: 'number', example: 250000.0 },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Land document file (PDF/image)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Land image file (JPG/PNG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Land successfully created',
    type: LandResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Builder only, must be verified',
  })
  create(
    @Body() createLandDto: CreateLandDto,
    @UploadedFiles()
    files: {
      document?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @CurrentUser() user: User,
  ) {
    const documentFile = files?.document?.[0];
    const imageFile = files?.image?.[0];
    return this.landsService.create(
      createLandDto,
      documentFile,
      imageFile,
      user.id,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BUILDER) // Admin or Builder (owner)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'document', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update property (builder only, before sale)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        location: { type: 'string' },
        size: { type: 'number' },
        price: { type: 'number' },
        status: {
          type: 'string',
          enum: ['available', 'locked', 'sold'],
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Land document file (PDF/image)',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Land image file (JPG/PNG)',
        },
      },
      required: [],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Land successfully updated',
    type: LandResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner/Admin only' })
  @ApiResponse({ status: 404, description: 'Land not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLandDto: UpdateLandDto,
    @UploadedFiles()
    files: {
      document?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
    @CurrentUser() user: User,
  ) {
    const documentFile = files?.document?.[0];
    const imageFile = files?.image?.[0];
    return this.landsService.update(
      id,
      updateLandDto,
      documentFile,
      imageFile,
      user.id,
      user.role,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BUILDER) // Admin or Builder (owner)
  @ApiOperation({ summary: 'Delete property (builder only, if not sold)' })
  @ApiResponse({
    status: 200,
    description: 'Land successfully deleted',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Land deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner/Admin only' })
  @ApiResponse({ status: 404, description: 'Land not found' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.landsService.remove(id, user.id, user.role);
    return {
      message: 'Land deleted successfully',
    };
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify document integrity' })
  @ApiResponse({
    status: 200,
    description: 'Verification result for both document and image',
    type: VerificationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async verifyDocument(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VerificationResponseDto> {
    return this.landsService.verifyDocumentIntegrity(id);
  }

  @Post(':id/verify-blockchain')
  @ApiOperation({ summary: 'Verify document hash against blockchain record' })
  @ApiResponse({
    status: 200,
    description: 'Blockchain verification result',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        message: { type: 'string' },
        databaseHash: { type: 'string' },
        blockchainHash: { type: 'string' },
        blockchainLandId: { type: 'number' },
        error: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Land not found' })
  async verifyBlockchain(@Param('id', ParseUUIDPipe) id: string) {
    return this.landsService.verifyBlockchainHash(id);
  }
}
