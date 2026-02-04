import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    Req,
    ParseUUIDPipe,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { OwnershipDocumentsService } from './ownership-documents.service';
import { CreateOwnershipDocumentDto } from './dto/create-ownership-document.dto';
import { AdminReviewDto } from './dto/admin-review.dto';
import { OwnershipDocumentResponseDto } from './dto/ownership-document-response.dto';

@Controller('ownership-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OwnershipDocumentsController {
    constructor(
        private readonly ownershipDocumentsService: OwnershipDocumentsService,
    ) { }

    /**
     * Builder uploads ownership documents for a property
     * POST /ownership-documents/lands/:landId
     */
    @Post('lands/:landId')
    @Roles(UserRole.BUILDER, UserRole.ADMIN)
    @UseInterceptors(FilesInterceptor('files', 10)) // Max 10 files
    async uploadOwnershipDocuments(
        @Param('landId', ParseUUIDPipe) landId: string,
        @Body() createDto: CreateOwnershipDocumentDto,
        @UploadedFiles() files: Express.Multer.File[],
        @Req() req: any,
    ): Promise<OwnershipDocumentResponseDto> {
        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }

        const builderId = req.user.userId;
        return this.ownershipDocumentsService.uploadOwnershipDocuments(
            landId,
            builderId,
            createDto,
            files,
        );
    }

    /**
     * Admin reviews ownership documents
     * POST /ownership-documents/:id/admin-review
     */
    @Post(':id/admin-review')
    @Roles(UserRole.ADMIN)
    async adminReview(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() reviewDto: AdminReviewDto,
        @Req() req: any,
    ): Promise<OwnershipDocumentResponseDto> {
        const adminId = req.user.userId;
        return this.ownershipDocumentsService.adminReview(id, adminId, reviewDto);
    }

    /**
     * Get pending ownership documents for admin review
     * GET /ownership-documents/admin-pending
     */
    @Get('admin-pending')
    @Roles(UserRole.ADMIN)
    async getPendingForAdmin(): Promise<OwnershipDocumentResponseDto[]> {
        return this.ownershipDocumentsService.getPendingForAdmin();
    }

    /**
     * Get ownership document by ID
     * GET /ownership-documents/:id
     */
    @Get(':id')
    @Roles(UserRole.BUILDER, UserRole.ADMIN, UserRole.USER)
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<OwnershipDocumentResponseDto> {
        return this.ownershipDocumentsService.findOne(id);
    }

    /**
     * Get ownership documents for a property
     * GET /ownership-documents/lands/:landId
     */
    @Get('lands/:landId')
    @Roles(UserRole.BUILDER, UserRole.ADMIN, UserRole.USER)
    async findByProperty(
        @Param('landId', ParseUUIDPipe) landId: string,
    ): Promise<OwnershipDocumentResponseDto[]> {
        return this.ownershipDocumentsService.findByProperty(landId);
    }

    /**
     * Get ownership documents uploaded by current builder
     * GET /ownership-documents/builder/me
     */
    @Get('builder/me')
    @Roles(UserRole.BUILDER, UserRole.ADMIN)
    async getMyDocuments(@Req() req: any): Promise<OwnershipDocumentResponseDto[]> {
        const builderId = req.user.userId;
        return this.ownershipDocumentsService.findByBuilder(builderId);
    }
}
