import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, ProjectStatus } from '../entities/project.entity';
import { User, UserRole } from '../entities/user.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { IpfsService } from '../common/services/ipfs.service';
import { HashService } from '../common/services/hash.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    private fileStorageService: FileStorageService,
    private ipfsService: IpfsService,
    private hashService: HashService,
  ) {}

  /**
   * Create a new project (Builder only)
   */
  async create(
    createProjectDto: CreateProjectDto,
    builderId: string,
  ): Promise<ProjectResponseDto> {
    // Verify builder exists and is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    if (!builder.isBuilderVerified) {
      throw new ForbiddenException(
        'Builder must be verified to create projects',
      );
    }

    const project = this.projectRepository.create({
      ...createProjectDto,
      builderId,
      totalUnits: createProjectDto.totalUnits || 0,
      status: ProjectStatus.PENDING_APPROVAL,
    });

    const savedProject = await this.projectRepository.save(project);
    this.logger.log(
      `Project ${savedProject.id} created by builder ${builderId}`,
    );

    // New project has no lands yet, so counts are 0
    const projectWithCounts = {
      ...savedProject,
      _count: {
        lands: 0,
      },
      soldUnits: 0,
    };

    return ProjectResponseDto.fromEntity(projectWithCounts);
  }

  /**
   * Get all projects with filters
   */
  async findAll(query: QueryProjectsDto): Promise<{
    data: ProjectResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, status, builderId, search } = query;

    const queryBuilder = this.projectRepository.createQueryBuilder('project');

    if (status) {
      queryBuilder.where('project.status = :status', { status });
    }

    if (builderId) {
      queryBuilder.andWhere('project.builderId = :builderId', { builderId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(project.name ILIKE :search OR project.location ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [projects, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('project.createdAt', 'DESC')
      .getManyAndCount();

    // For each project, calculate lands count and sold units
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        // Count total lands in this project
        const landsCount = await this.landRepository.count({
          where: { projectId: project.id },
        });

        // Count sold units - lands with status OWNED or SOLD
        // Using In() operator to check for multiple statuses
        const soldUnits = await this.landRepository.count({
          where: {
            projectId: project.id,
            status: In([LandStatus.OWNED, LandStatus.SOLD]),
          },
        });

        return {
          ...project,
          _count: {
            lands: landsCount,
          },
          soldUnits: soldUnits,
        };
      }),
    );

    return {
      data: projectsWithCounts.map((project) =>
        ProjectResponseDto.fromEntity(project),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get project by ID
   */
  async findOne(
    id: string,
    includeRelations = false,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: includeRelations ? ['builder', 'lands'] : [],
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Calculate lands count and sold units
    const landsCount = await this.landRepository.count({
      where: { projectId: project.id },
    });

    const soldUnits = await this.landRepository.count({
      where: {
        projectId: project.id,
        status: In([LandStatus.OWNED, LandStatus.SOLD]),
      },
    });

    const projectWithCounts = {
      ...project,
      _count: {
        lands: landsCount,
      },
      soldUnits: soldUnits,
    };

    return ProjectResponseDto.fromEntity(projectWithCounts, includeRelations);
  }

  /**
   * Get project with all properties
   */
  async findOneWithProperties(id: string): Promise<ProjectResponseDto> {
    return this.findOne(id, true);
  }

  /**
   * Get project approval + land-creation gating status (used by frontend)
   */
  async getApprovalStatus(id: string): Promise<{
    projectId: string;
    status: ProjectStatus;
    isApproved: boolean;
    canCreateLands: boolean;
    totalUnits: number;
    landsCount: number;
    remainingUnits: number;
  }> {
    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const landsCount = await this.landRepository.count({
      where: { projectId: id },
    });

    const isApproved = project.status === ProjectStatus.APPROVED;
    const totalUnits = project.totalUnits;
    const remainingUnits = Math.max(0, totalUnits - landsCount);

    // Mirrors land creation rules in LandsService:
    // - must be approved
    // - totalUnits must be >= 1
    // - landsCount must be < totalUnits
    const canCreateLands =
      isApproved && totalUnits >= 1 && landsCount < totalUnits;

    return {
      projectId: project.id,
      status: project.status,
      isApproved,
      canCreateLands,
      totalUnits,
      landsCount,
      remainingUnits,
    };
  }

  /**
   * Update project (Builder/Owner or Admin)
   */
  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
    userRole: UserRole,
  ): Promise<ProjectResponseDto> {
    this.logger.log(
      `[UPDATE] Starting update for project ${id} by user ${userId} (role: ${userRole})`,
    );
    this.logger.debug(
      `[UPDATE] Update data received: ${JSON.stringify(updateProjectDto)}`,
    );

    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      this.logger.warn(`[UPDATE] FAILED - Project ${id} not found`);
      throw new NotFoundException('Project not found');
    }

    this.logger.log(
      `[UPDATE] Project found: ${project.name} (status: ${project.status}, builderId: ${project.builderId})`,
    );

    // Check permission
    if (project.builderId !== userId && userRole !== UserRole.ADMIN) {
      this.logger.warn(
        `[UPDATE] FAILED - Permission denied. User ${userId} (role: ${userRole}) cannot update project owned by ${project.builderId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to update this project',
      );
    }

    this.logger.log(`[UPDATE] Permission check passed`);

    // Check if project can be updated (not completed)
    if (userRole !== UserRole.ADMIN) {
      if (project.status === ProjectStatus.COMPLETED) {
        this.logger.warn(
          `[UPDATE] FAILED - Cannot update project with status "${project.status}"`,
        );
        throw new BadRequestException(
          `Cannot update project with status "${project.status}"`,
        );
      }
    }

    this.logger.log(`[UPDATE] Status check passed`);

    // Log the actual DTO object structure
    this.logger.debug(
      `[UPDATE] DTO object keys: ${Object.keys(updateProjectDto).join(', ')}`,
    );
    this.logger.debug(
      `[UPDATE] DTO raw values - name: ${updateProjectDto.name}, location: ${updateProjectDto.location}, description: ${updateProjectDto.description}, locationDetails: ${updateProjectDto.locationDetails}, totalUnits: ${updateProjectDto.totalUnits}, status: ${updateProjectDto.status}`,
    );
    this.logger.debug(
      `[UPDATE] DTO value types - name: ${typeof updateProjectDto.name}, location: ${typeof updateProjectDto.location}, description: ${typeof updateProjectDto.description}, locationDetails: ${typeof updateProjectDto.locationDetails}, totalUnits: ${typeof updateProjectDto.totalUnits}`,
    );

    // Store original values for logging
    const originalValues = {
      name: project.name,
      description: project.description,
      location: project.location,
      locationDetails: project.locationDetails,
      status: project.status,
      totalUnits: project.totalUnits,
    };

    // Track which fields are being updated
    const fieldsToUpdate: string[] = [];

    // Only update fields that are provided (not undefined and not null)
    // Use 'in' operator to check if key exists, then check if value is not undefined/null/empty
    if (
      'name' in updateProjectDto &&
      updateProjectDto.name !== undefined &&
      updateProjectDto.name !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating name: "${originalValues.name}" → "${updateProjectDto.name}"`,
      );
      project.name = updateProjectDto.name;
      fieldsToUpdate.push('name');
    }
    if (
      'description' in updateProjectDto &&
      updateProjectDto.description !== undefined &&
      updateProjectDto.description !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating description: "${originalValues.description}" → "${updateProjectDto.description}"`,
      );
      project.description = updateProjectDto.description;
      fieldsToUpdate.push('description');
    }
    if (
      'location' in updateProjectDto &&
      updateProjectDto.location !== undefined &&
      updateProjectDto.location !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating location: "${originalValues.location}" → "${updateProjectDto.location}"`,
      );
      project.location = updateProjectDto.location;
      fieldsToUpdate.push('location');
    }
    if (
      'locationDetails' in updateProjectDto &&
      updateProjectDto.locationDetails !== undefined &&
      updateProjectDto.locationDetails !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating locationDetails: "${originalValues.locationDetails}" → "${updateProjectDto.locationDetails}"`,
      );
      project.locationDetails = updateProjectDto.locationDetails;
      fieldsToUpdate.push('locationDetails');
    }
    if (
      'status' in updateProjectDto &&
      updateProjectDto.status !== undefined &&
      updateProjectDto.status !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating status: "${originalValues.status}" → "${updateProjectDto.status}"`,
      );
      project.status = updateProjectDto.status;
      fieldsToUpdate.push('status');
    }
    if (
      'totalUnits' in updateProjectDto &&
      updateProjectDto.totalUnits !== undefined &&
      updateProjectDto.totalUnits !== null
    ) {
      this.logger.debug(
        `[UPDATE] Updating totalUnits: ${originalValues.totalUnits} → ${updateProjectDto.totalUnits}`,
      );
      project.totalUnits = updateProjectDto.totalUnits;
      fieldsToUpdate.push('totalUnits');
    }

    if (fieldsToUpdate.length === 0) {
      this.logger.warn(
        `[UPDATE] WARNING - No fields to update. All values in DTO are undefined.`,
      );
    } else {
      this.logger.log(
        `[UPDATE] Fields to update: ${fieldsToUpdate.join(', ')}`,
      );
    }

    try {
      const updatedProject = await this.projectRepository.save(project);
      this.logger.log(
        `[UPDATE] SUCCESS - Project ${id} updated successfully. Updated fields: ${fieldsToUpdate.join(', ')}`,
      );
      this.logger.debug(
        `[UPDATE] Final values: name="${updatedProject.name}", location="${updatedProject.location}", totalUnits=${updatedProject.totalUnits}`,
      );

      // Calculate counts for response
      const landsCount = await this.landRepository.count({
        where: { projectId: updatedProject.id },
      });

      const soldUnits = await this.landRepository.count({
        where: {
          projectId: updatedProject.id,
          status: In([LandStatus.OWNED, LandStatus.SOLD]),
        },
      });

      const projectWithCounts = {
        ...updatedProject,
        _count: {
          lands: landsCount,
        },
        soldUnits: soldUnits,
      };

      return ProjectResponseDto.fromEntity(projectWithCounts);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[UPDATE] FAILED - Error saving project ${id}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  /**
   * Approve project (Admin only)
   */
  async approveProject(
    id: string,
    userId: string,
    userRole: UserRole,
  ): Promise<ProjectResponseDto> {
    // Only admins can approve projects
    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can approve projects');
    }

    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if project is already approved or completed
    if (project.status === ProjectStatus.APPROVED) {
      throw new BadRequestException('Project is already approved');
    }

    if (project.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException('Cannot approve a completed project');
    }

    // Update status to approved
    project.status = ProjectStatus.APPROVED;
    const updatedProject = await this.projectRepository.save(project);

    this.logger.log(
      `Project ${id} approved by admin ${userId}. Status changed from ${ProjectStatus.PENDING_APPROVAL} to ${ProjectStatus.APPROVED}`,
    );

    // Calculate counts for response
    const landsCount = await this.landRepository.count({
      where: { projectId: updatedProject.id },
    });

    const soldUnits = await this.landRepository.count({
      where: {
        projectId: updatedProject.id,
        status: In([LandStatus.OWNED, LandStatus.SOLD]),
      },
    });

    const projectWithCounts = {
      ...updatedProject,
      _count: {
        lands: landsCount,
      },
      soldUnits: soldUnits,
    };

    return ProjectResponseDto.fromEntity(projectWithCounts);
  }

  /**
   * Delete project (Builder/Owner or Admin)
   */
  async remove(id: string, userId: string, userRole: UserRole): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permission
    if (project.builderId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to delete this project',
      );
    }

    // Check if project has properties (lands). If yes, project cannot be deleted by anyone.
    const propertiesCount = await this.landRepository.count({
      where: { projectId: id },
    });

    if (propertiesCount > 0) {
      throw new BadRequestException(
        'Cannot delete project with existing properties. Delete properties first.',
      );
    }

    await this.projectRepository.remove(project);
    this.logger.log(`Project ${id} deleted by user ${userId}`);
  }

  /**
   * Upload project approval documents
   */
  async uploadApprovalDocuments(
    id: string,
    file: Express.Multer.File,
    userId: string,
    userRole: UserRole,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.findOne({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permission
    if (project.builderId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to upload documents for this project',
      );
    }

    // Delete old file if exists
    if (project.approvalDocumentsCID) {
      try {
        const fileName = project.approvalDocumentsCID.split('/').pop();
        if (fileName) {
          await this.fileStorageService.deleteFile(
            'project-approvals',
            fileName,
          );
        }
      } catch (error) {
        this.logger.error('Error deleting old approval document:', error);
      }
    }

    // Upload to local storage
    const uploadResult = await this.fileStorageService.uploadFile(
      'project-approvals',
      file,
    );
    project.approvalDocumentsCID = uploadResult.path;
    // Note: approvalDocumentsUrl would be stored if we add that field

    // Calculate SHA-256 hash for tamper detection
    project.approvalDocumentsHash = this.hashService.calculateSHA256(
      file.buffer,
    );

    // Upload to IPFS
    try {
      const ipfsResult = await this.ipfsService.uploadFile(file);
      project.approvalDocumentsIPFSHash = this.ipfsService.formatIPFSHash(
        ipfsResult.hash,
        ipfsResult.gateway,
        ipfsResult.timestamp,
      );
    } catch (error) {
      this.logger.error('Failed to upload approval documents to IPFS:', error);
      // Continue without IPFS hash if upload fails
    }

    const updatedProject = await this.projectRepository.save(project);

    // Calculate counts for response
    const landsCount = await this.landRepository.count({
      where: { projectId: updatedProject.id },
    });

    const soldUnits = await this.landRepository.count({
      where: {
        projectId: updatedProject.id,
        status: In([LandStatus.OWNED, LandStatus.SOLD]),
      },
    });

    const projectWithCounts = {
      ...updatedProject,
      _count: {
        lands: landsCount,
      },
      soldUnits: soldUnits,
    };

    return ProjectResponseDto.fromEntity(projectWithCounts);
  }

  /**
   * Verify approval document integrity by comparing SHA-256 hash
   * Reads stored file from uploads and compares its hash with stored hash in database
   * @param projectId - Project ID
   * @returns Verification result for approval document
   */
  async verifyDocumentIntegrity(projectId: string): Promise<{
    verified: boolean;
    message: string;
    document?: {
      verified: boolean;
      message: string;
      storedHash?: string;
      calculatedHash?: string;
    };
  }> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      return {
        verified: false,
        message: 'Project not found',
      };
    }

    // Verify approval document
    const documentResult = await this.verifyApprovalDocument(project);

    const allVerified = documentResult.verified;

    return {
      verified: allVerified,
      message: allVerified
        ? 'Approval document verified successfully.'
        : 'Approval document verification failed.',
      document: documentResult,
    };
  }

  /**
   * Verify approval document integrity by comparing SHA-256 hash
   * @param project - Project entity
   * @returns Verification result for the approval document
   */
  private async verifyApprovalDocument(project: Project): Promise<{
    verified: boolean;
    message: string;
    storedHash?: string;
    calculatedHash?: string;
  }> {
    const storedHash = project.approvalDocumentsHash;
    const filePath = project.approvalDocumentsCID;

    if (!storedHash || !filePath) {
      return {
        verified: false,
        message: 'Approval document not available for verification.',
      };
    }

    try {
      // Extract filename from path (e.g., "project-approvals/1234567890-doc.pdf" -> "1234567890-doc.pdf")
      const fileName = filePath.split('/').pop() || filePath;

      // Read file from storage
      const fileBuffer = await this.fileStorageService.readFile(
        'project-approvals',
        fileName,
      );

      // Calculate hash of stored file
      const calculatedHash = this.hashService.calculateSHA256(fileBuffer);
      const verified = this.hashService.verifyHash(fileBuffer, storedHash);

      if (verified) {
        return {
          verified: true,
          message:
            'Approval document is genuine and has not been tampered with.',
          storedHash,
          calculatedHash,
        };
      } else {
        return {
          verified: false,
          message:
            'Approval document verification failed. The file may have been tampered with.',
          storedHash,
          calculatedHash,
        };
      }
    } catch (error) {
      return {
        verified: false,
        message: `Failed to read approval document file: ${(error as Error).message}`,
        storedHash,
      };
    }
  }
}
