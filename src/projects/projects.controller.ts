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
} from '@nestjs/common';
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
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Create a new project (Builder only)' })
  @ApiResponse({
    status: 201,
    description: 'Project successfully created',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Builder not verified' })
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: User,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.create(createProjectDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: [ProjectResponseDto],
  })
  async findAll(@Query() query: QueryProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(id);
  }

  @Get(':id/properties')
  @ApiOperation({ summary: 'Get all properties in project' })
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
  @ApiOperation({ summary: 'Update project (Owner or Admin)' })
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
  ): Promise<ProjectResponseDto> {
    return this.projectsService.update(id, updateProjectDto, user.id, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project (Owner or Admin)' })
  @ApiResponse({ status: 200, description: 'Project deleted' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.projectsService.remove(id, user.id, user.role);
  }

  @Post(':id/approval-documents')
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload project approval documents (Builder or Admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        document: {
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
    return this.projectsService.uploadApprovalDocuments(id, file, user.id, user.role);
  }
}

