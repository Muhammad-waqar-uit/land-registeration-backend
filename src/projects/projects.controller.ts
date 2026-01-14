import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
  ParseUUIDPipe,
  Logger,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.BUILDER)
  @UseInterceptors(FileInterceptor('approvalDocuments'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Create a new project (Builder only) ✅' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Luxury Apartments Phase 1' },
        description: { type: 'string', example: 'Modern luxury apartments' },
        location: { type: 'string', example: 'Downtown Area, City' },
        locationDetails: { type: 'string', example: 'Near Central Park' },
        totalUnits: { type: 'number', example: 50 },
        approvalDocuments: {
          type: 'string',
          format: 'binary',
          description: 'Approval documents file (optional, can upload later)',
        },
      },
      required: ['name', 'location'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Project successfully created',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Builder not verified' })
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.create(
      createProjectDto,
      user.id,
    );

    // If file was uploaded during creation, upload it
    if (file) {
      return this.projectsService.uploadApprovalDocuments(
        project.id,
        file,
        user.id,
        user.role,
      );
    }

    return project;
  }

  @Get()
  @ApiOperation({ summary: 'List all projects with optional filters ✅' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: [ProjectResponseDto],
  })
  async findAll(@Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID ✅' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(id);
  }

  @Get(':id/properties')
  @ApiOperation({ summary: 'Get all properties in project ✅' })
  @ApiResponse({
    status: 200,
    description: 'List of properties in the project',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectProperties(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.findOneWithProperties(id);
  }

  @Patch(':id')
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({ summary: 'Update project (Owner or Admin) ✅' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Project Name' },
        location: { type: 'string', example: 'Updated Location' },
        description: { type: 'string', example: 'Updated description' },
        locationDetails: {
          type: 'string',
          example: 'Updated location details',
        },
        totalUnits: { type: 'number', example: 50 },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'completed', 'cancelled'],
        },
      },
    },
    description: 'Project update data (supports both JSON and FormData)',
  })
  @ApiResponse({
    status: 200,
    description: 'Project updated',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: User,
    @Req() request: Request,
  ): Promise<ProjectResponseDto> {
    // Log raw request body from Express
    this.logger.debug(
      `[CONTROLLER] Raw Express request body: ${JSON.stringify(request.body)}`,
    );
    this.logger.debug(
      `[CONTROLLER] Content-Type: ${request.headers['content-type']}`,
    );

    this.logger.log(
      `[CONTROLLER] Update request received for project ${id} from user ${user.id} (${user.email})`,
    );
    this.logger.debug(
      `[CONTROLLER] Transformed DTO: ${JSON.stringify(updateProjectDto)}`,
    );
    this.logger.debug(
      `[CONTROLLER] Request body (detailed): ${JSON.stringify(
        {
          name: updateProjectDto.name,
          nameType: typeof updateProjectDto.name,
          nameExists: 'name' in updateProjectDto,
          location: updateProjectDto.location,
          locationType: typeof updateProjectDto.location,
          locationExists: 'location' in updateProjectDto,
          description: updateProjectDto.description,
          descriptionType: typeof updateProjectDto.description,
          descriptionExists: 'description' in updateProjectDto,
          locationDetails: updateProjectDto.locationDetails,
          locationDetailsType: typeof updateProjectDto.locationDetails,
          locationDetailsExists: 'locationDetails' in updateProjectDto,
          totalUnits: updateProjectDto.totalUnits,
          totalUnitsType: typeof updateProjectDto.totalUnits,
          totalUnitsExists: 'totalUnits' in updateProjectDto,
          status: updateProjectDto.status,
          statusType: typeof updateProjectDto.status,
          statusExists: 'status' in updateProjectDto,
        },
        null,
        2,
      )}`,
    );

    try {
      const result = await this.projectsService.update(
        id,
        updateProjectDto,
        user.id,
        user.role,
      );
      this.logger.log(
        `[CONTROLLER] SUCCESS - Project ${id} updated successfully`,
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[CONTROLLER] FAILED - Error updating project ${id}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project (Owner or Admin) ✅' })
  @ApiResponse({ status: 200, description: 'Project deleted' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.projectsService.remove(id, user.id, user.role);
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify approval document integrity ✅' })
  @ApiResponse({
    status: 200,
    description: 'Verification result for approval document',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Approval document verified successfully.',
        },
        document: {
          type: 'object',
          properties: {
            verified: { type: 'boolean', example: true },
            message: {
              type: 'string',
              example:
                'Approval document is genuine and has not been tampered with.',
            },
            storedHash: {
              type: 'string',
              example: 'a1b2c3d4e5f6...',
            },
            calculatedHash: {
              type: 'string',
              example: 'a1b2c3d4e5f6...',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async verifyDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.verifyDocumentIntegrity(id);
  }

  @Post(':id/approval-documents')
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('approvalDocuments'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload project approval documents (Builder or Admin) ✅     ',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        approvalDocuments: {
          type: 'string',
          format: 'binary',
          description: 'Approval documents file (PDF, Image, etc.)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Approval documents uploaded successfully',
    type: ProjectResponseDto,
  })
  async uploadApprovalDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.projectsService.uploadApprovalDocuments(
      id,
      file,
      user.id,
      user.role,
    );
  }
}
