import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { SignAgreementDto } from './dto/sign-agreement.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { AgreementResponseDto } from './dto/agreement-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../entities/user.entity';

@ApiTags('Agreements')
@Controller('agreements')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Create a new agreement (Builder only)' })
  @ApiResponse({
    status: 201,
    description: 'Agreement successfully created',
    type: AgreementResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only, must be verified' })
  @ApiResponse({ status: 404, description: 'Property or buyer not found' })
  create(
    @Body() createAgreementDto: CreateAgreementDto,
    @CurrentUser() user: User,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.createAgreement(createAgreementDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all agreements with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'List of agreements',
    type: [AgreementResponseDto],
  })
  findAll(@Query() query: QueryAgreementsDto) {
    return this.agreementsService.findAll(query);
  }

  // This must come before :id route
  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get agreements for property' })
  @ApiResponse({
    status: 200,
    description: 'List of agreements for the property',
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  getPropertyAgreements(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() query: QueryAgreementsDto,
  ) {
    return this.agreementsService.findAll({ ...query, propertyId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agreement by ID' })
  @ApiResponse({
    status: 200,
    description: 'Agreement details',
    type: AgreementResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AgreementResponseDto> {
    return this.agreementsService.findOne(id);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign an agreement (Buyer or Builder)' })
  @ApiResponse({
    status: 200,
    description: 'Agreement successfully signed',
    type: AgreementResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to sign' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() signDto: SignAgreementDto,
    @CurrentUser() user: User,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.signAgreement(id, user.id, user.role, signDto);
  }

  @Post(':id/generate-ownership-doc')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BUILDER)
  @ApiOperation({ summary: 'Generate final ownership document (Builder only)' })
  @ApiResponse({
    status: 200,
    description: 'Final ownership document generated',
    type: AgreementResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Builder only' })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  generateOwnershipDoc(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<AgreementResponseDto> {
    return this.agreementsService.transferOwnership(id, user.id);
  }

  @Post(':id/upload-signed')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload signed document' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          format: 'binary',
          description: 'Signed agreement document',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Signed document uploaded successfully',
    type: AgreementResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  uploadSigned(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<AgreementResponseDto> {
    // This will be implemented in service - for now return findOne
    // The service method can handle signed document upload
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.agreementsService.findOne(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify agreement signatures and document integrity' })
  @ApiResponse({
    status: 200,
    description: 'Verification result',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        message: { type: 'string' },
        signaturesVerified: { type: 'boolean' },
        documentVerified: { type: 'boolean' },
        agreement: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Agreement not found' })
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.agreementsService.verifyAgreement(id);
  }
}

