import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TransferRequestsService } from './transfer-requests.service';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { ConfirmPaymentAndTransferDto } from './dto/confirm-payment-transfer.dto';
import { UploadDocumentsDto } from './dto/upload-documents.dto';
import { QueryTransferRequestsDto } from './dto/query-transfer-requests.dto';
import { TransferRequestResponseDto } from './dto/transfer-request-response.dto';
import { TransferAdminReviewDto } from './dto/transfer-admin-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('Transfer Requests')
@Controller('transfer-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TransferRequestsController {
  constructor(
    private readonly transferRequestsService: TransferRequestsService,
  ) {}

  @Post('resale/:resaleRequestId/confirm-payment')
  @ApiOperation({
    summary: 'Seller confirms payment received and allows document change (payment-first flow)',
    description:
      'Seller must confirm full payment has been received before transfer documents can be uploaded. Creates transfer request. Full payment must be complete on the property.',
  })
  @ApiResponse({ status: 201, type: TransferRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Payment not complete or property not listed' })
  async confirmPaymentAndAllowTransfer(
    @Param('resaleRequestId') resaleRequestId: string,
    @Body() confirmDto: ConfirmPaymentAndTransferDto,
    @Req() req,
  ): Promise<TransferRequestResponseDto> {
    return this.transferRequestsService.confirmPaymentAndAllowTransfer(
      resaleRequestId,
      req.user.id,
      confirmDto,
    );
  }

  @Post('resale/:resaleRequestId')
  @ApiOperation({
    summary: 'Seller creates transfer request (without payment confirmation)',
    description:
      'Legacy: creates transfer request without payment check. Prefer confirm-payment for payment-first flow.',
  })
  @ApiResponse({ status: 201, type: TransferRequestResponseDto })
  async create(
    @Param('resaleRequestId') resaleRequestId: string,
    @Body() createDto: CreateTransferRequestDto,
    @Req() req,
  ): Promise<TransferRequestResponseDto> {
    return this.transferRequestsService.createTransferRequest(
      resaleRequestId,
      req.user.id,
      createDto,
    );
  }

  @Get('my-transfers')
  @ApiOperation({ summary: 'Get own transfer requests (seller)' })
  @ApiResponse({ status: 200, type: [TransferRequestResponseDto] })
  async getMyTransfers(
    @Query() query: QueryTransferRequestsDto,
    @Req() req,
  ): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.transferRequestsService.findOwnerTransferRequests(
      req.user.id,
      query,
    );
  }

  @Get('builder-requests')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Get transfer requests for builder properties' })
  @ApiResponse({ status: 200, type: [TransferRequestResponseDto] })
  async getBuilderRequests(
    @Query() query: QueryTransferRequestsDto,
    @Req() req,
  ): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.transferRequestsService.findBuilderTransferRequests(
      req.user.id,
      query,
    );
  }

  @Post(':id/upload-documents')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Builder uploads transfer documents' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        builderNotes: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: TransferRequestResponseDto })
  async uploadDocuments(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadDocumentsDto,
    @Req() req,
  ): Promise<TransferRequestResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    return this.transferRequestsService.uploadDocuments(
      id,
      req.user.id,
      files,
      uploadDto.builderNotes,
    );
  }

  @Post(':id/complete-transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Complete ownership transfer (Builder or Admin)' })
  @ApiResponse({ status: 200, type: TransferRequestResponseDto })
  async completeTransfer(
    @Param('id') id: string,
    @Req() req,
  ): Promise<TransferRequestResponseDto> {
    return this.transferRequestsService.completeTransfer(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all transfer requests (Admin only)' })
  @ApiResponse({ status: 200, type: [TransferRequestResponseDto] })
  async findAll(@Query() query: QueryTransferRequestsDto): Promise<{
    data: TransferRequestResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.transferRequestsService.findAll(query);
  }

  @Get('pending-admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get transfer requests pending admin review' })
  @ApiResponse({ status: 200, type: [TransferRequestResponseDto] })
  async getPendingForAdmin(): Promise<TransferRequestResponseDto[]> {
    return this.transferRequestsService.getPendingForAdmin();
  }

  @Post(':id/admin-review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin approves or rejects transfer request' })
  @ApiResponse({ status: 200, type: TransferRequestResponseDto })
  async adminReview(
    @Param('id') id: string,
    @Body() reviewDto: TransferAdminReviewDto,
    @Req() req,
  ): Promise<TransferRequestResponseDto> {
    return this.transferRequestsService.adminReviewTransfer(
      id,
      req.user.id,
      reviewDto,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer request  by ID' })
  @ApiResponse({ status: 200, type: TransferRequestResponseDto })
  async findOne(@Param('id') id: string): Promise<TransferRequestResponseDto> {
    return this.transferRequestsService.findOne(id);
  }
}
