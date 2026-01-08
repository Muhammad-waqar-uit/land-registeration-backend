import { ApiProperty } from '@nestjs/swagger';
import { Project, ProjectStatus } from '../../entities/project.entity';
import { BuilderResponseDto } from '../../builders/dto/builder-response.dto';
import { LandResponseDto } from '../../lands/dto/land-response.dto';

export class ProjectResponseDto {
  @ApiProperty({ description: 'Project ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Project name', example: 'Luxury Apartments Phase 1' })
  name: string;

  @ApiProperty({ description: 'Project description', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Project location', example: 'Downtown Area, City' })
  location: string;

  @ApiProperty({ description: 'Detailed location information', nullable: true })
  locationDetails: string | null;

  @ApiProperty({ description: 'Project status', enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty({ description: 'Total number of units', example: 50 })
  totalUnits: number;

  @ApiProperty({ description: 'Number of sold units', example: 25 })
  soldUnits: number;

  @ApiProperty({ description: 'Approval documents CID (local storage path)', nullable: true })
  approvalDocumentsCID: string | null;

  @ApiProperty({ description: 'Approval documents URL', nullable: true })
  approvalDocumentsIPFSHash: string | null;

  @ApiProperty({ description: 'Approval documents hash (SHA-256)', nullable: true })
  approvalDocumentsHash: string | null;

  @ApiProperty({ description: 'Builder ID' })
  builderId: string;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Builder information', type: BuilderResponseDto, required: false })
  builder?: BuilderResponseDto;

  @ApiProperty({ description: 'Properties in project', type: [LandResponseDto], required: false })
  lands?: LandResponseDto[];

  static fromEntity(project: Project, includeRelations = false): ProjectResponseDto {
    const {
      builder,
      lands,
      ...projectResponse
    } = project;

    const response: ProjectResponseDto = {
      ...projectResponse,
    };

    if (includeRelations) {
      if (builder) {
        response.builder = BuilderResponseDto.fromEntity(builder);
      }
      if (lands) {
        response.lands = lands.map((land) => LandResponseDto.fromEntity(land));
      }
    }

    return response;
  }
}

