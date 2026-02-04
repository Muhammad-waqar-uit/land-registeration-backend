import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TokenRequestsService } from './token-requests.service';
import { CreateTokenRequestDto } from './dto/create-token-request.dto';
import { RespondTokenRequestDto } from './dto/respond-token-request.dto';
import { QueryTokenRequestsDto } from './dto/query-token-requests.dto';
import { TokenRequestResponseDto } from './dto/token-request-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Token Requests')
@Controller('token-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TokenRequestsController {
  constructor(private readonly tokenRequestsService: TokenRequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a token request (User: Buyer/Seller/Builder)',
  })
  @ApiResponse({
    status: 201,
    description: 'Token request successfully created',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  create(
    @Body() createDto: CreateTokenRequestDto,
    @CurrentUser() user: User,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.createTokenRequest(createDto, user.id);
  }

  @Post('upload-screenshot')
  @ApiOperation({
    summary: 'Upload screenshot for token request',
    description:
      'Upload a screenshot/proof file and get the URL to use in token request',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Screenshot uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: '/uploads/screenshots/abc123.png' },
        filename: { type: 'string', example: 'abc123.png' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/screenshots',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `screenshot-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|pdf)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files and PDFs are allowed!'), false);
        }
      },
    }),
  )
  uploadScreenshot(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return {
      url: `/uploads/screenshots/${file.filename}`,
      filename: file.filename,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all token requests (Admin only)',
    description: 'Get all token requests with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of token requests',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TokenRequestResponseDto' },
        },
        total: { type: 'number', example: 50 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  findAll(@Query() query: QueryTokenRequestsDto) {
    return this.tokenRequestsService.findAll(query);
  }

  @Get('my-requests')
  @ApiOperation({
    summary: "Get user's own token requests",
    description: 'Retrieve all token requests made by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: "List of user's token requests",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TokenRequestResponseDto' },
        },
        total: { type: 'number', example: 10 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  findMyRequests(
    @Query() query: QueryTokenRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.tokenRequestsService.findUserRequests(user.id, query);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get pending token requests (Admin only)',
    description: 'Retrieve all pending token requests awaiting admin approval',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending token requests',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/TokenRequestResponseDto' },
        },
        total: { type: 'number', example: 15 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  findPendingRequests(@Query() query: QueryTokenRequestsDto) {
    return this.tokenRequestsService.findPendingRequests(query);
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get token request statistics (Admin only)',
    description:
      'Get overview statistics of all token requests including counts and amounts',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 100 },
        pending: { type: 'number', example: 15 },
        approved: { type: 'number', example: 70 },
        rejected: { type: 'number', example: 15 },
        totalAmountRequested: { type: 'number', example: 500000.0 },
        totalAmountApproved: { type: 'number', example: 350000.0 },
      },
    },
  })
  getStatistics() {
    return this.tokenRequestsService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get token request by ID',
    description:
      'Get a single token request by ID with user and reviewer details',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request details',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Token request not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.findOne(id);
  }

  @Post(':id/respond')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Respond to token request - Approve or Reject (Admin only)',
    description:
      'Admin can approve or reject a pending token request with optional notes',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request successfully responded to',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Token request not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status or request already processed',
  })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() respondDto: RespondTokenRequestDto,
    @CurrentUser() user: User,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.respondToTokenRequest(
      id,
      respondDto,
      user.id,
    );
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approve token request (Admin only)',
    description: 'Quick approve endpoint for token requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request approved',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Token request not found' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.respondToTokenRequest(
      id,
      { status: 'approved' as any },
      user.id,
    );
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reject token request (Admin only)',
    description: 'Quick reject endpoint for token requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request rejected',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Token request not found' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.respondToTokenRequest(
      id,
      { status: 'rejected' as any },
      user.id,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel token request (User only)',
    description: 'User can cancel their own pending token request',
  })
  @ApiResponse({
    status: 200,
    description: 'Token request successfully cancelled',
    type: TokenRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized' })
  @ApiResponse({ status: 404, description: 'Token request not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel non-pending request',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<TokenRequestResponseDto> {
    return this.tokenRequestsService.cancelTokenRequest(id, user.id);
  }
}
