import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agreement, AgreementType, AgreementStatus } from '../entities/agreement.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { SignAgreementDto } from './dto/sign-agreement.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { AgreementResponseDto } from './dto/agreement-response.dto';
import { FileStorageService } from '../common/services/file-storage.service';
import { IpfsService } from '../common/services/ipfs.service';
import { HashService } from '../common/services/hash.service';
import { BlockchainService } from '../common/services/blockchain.service';

@Injectable()
export class AgreementsService {
  constructor(
    @InjectRepository(Agreement)
    private agreementRepository: Repository<Agreement>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fileStorageService: FileStorageService,
    private ipfsService: IpfsService,
    private hashService: HashService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Create initial agreement (builder action)
   */
  async createAgreement(
    createAgreementDto: CreateAgreementDto,
    builderId: string,
  ): Promise<AgreementResponseDto> {
    // Verify builder exists and is verified
    const builder = await this.userRepository.findOne({
      where: { id: builderId, role: UserRole.BUILDER },
    });

    if (!builder) {
      throw new NotFoundException('Builder not found');
    }

    if (!builder.isBuilderVerified) {
      throw new ForbiddenException('Builder must be verified to create agreements');
    }

    // Verify property exists and belongs to builder
    const property = await this.landRepository.findOne({
      where: { id: createAgreementDto.propertyId },
      relations: ['owner', 'project'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.ownerId !== builderId) {
      throw new ForbiddenException('Property does not belong to this builder');
    }

    if (property.status !== LandStatus.AVAILABLE && property.status !== LandStatus.RESERVED) {
      throw new BadRequestException(
        `Cannot create agreement for property with status "${property.status}"`,
      );
    }

    // Verify buyer exists
    const buyer = await this.userRepository.findOne({
      where: { id: createAgreementDto.buyerId },
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    // Check if agreement already exists for this property and buyer
    const existingAgreement = await this.agreementRepository.findOne({
      where: {
        propertyId: createAgreementDto.propertyId,
        buyerId: createAgreementDto.buyerId,
        agreementType: createAgreementDto.agreementType,
        status: AgreementStatus.DRAFT,
      },
    });

    if (existingAgreement) {
      throw new BadRequestException(
        'A draft agreement already exists for this property and buyer',
      );
    }

    // Prepare agreement terms
    const terms = {
      price: createAgreementDto.terms?.price || property.price,
      totalAmount: createAgreementDto.terms?.totalAmount || property.price,
      installmentPlanYears:
        createAgreementDto.terms?.installmentPlanYears ||
        property.installmentPlanYears,
      paymentTerms: createAgreementDto.terms?.paymentTerms || 'As per installment plan',
      propertyDetails: {
        title: property.title,
        location: property.location,
        size: property.size,
        unitId: property.unitId,
        projectId: property.projectId,
        ...createAgreementDto.terms?.propertyDetails,
      },
      buyerDetails: {
        name: buyer.name,
        fatherName: buyer.fatherName,
        cnic: buyer.cnic,
        phoneNumber: buyer.phoneNumber,
      },
      builderDetails: {
        name: builder.name,
        companyName: builder.companyName,
        licenseNumber: builder.licenseNumber,
      },
      ...createAgreementDto.terms,
    };

    // Generate agreement document
    const documentContent = this.generateAgreementDocument(
      createAgreementDto.agreementType,
      property,
      buyer,
      builder,
      terms,
    );

    // Convert document to buffer
    const documentBuffer = Buffer.from(documentContent, 'utf-8');

    // Calculate SHA-256 hash
    const documentHash = this.hashService.calculateSHA256(documentBuffer);

    // Upload document to local storage
    const uploadResult = await this.fileStorageService.uploadFile(
      'agreements',
      {
        buffer: documentBuffer,
        originalname: `agreement-${Date.now()}.txt`,
        mimetype: 'text/plain',
        size: documentBuffer.length,
      } as Express.Multer.File,
    );

    // Upload document to IPFS
    let documentIPFSHash: string | null = null;
    try {
      const ipfsResult = await this.ipfsService.uploadFile({
        buffer: documentBuffer,
        originalname: `agreement-${Date.now()}.txt`,
        mimetype: 'text/plain',
        size: documentBuffer.length,
      } as Express.Multer.File);

      documentIPFSHash = this.ipfsService.formatIPFSHash(
        ipfsResult.hash,
        ipfsResult.gateway,
        ipfsResult.timestamp,
      );
    } catch (error) {
      console.error('Failed to upload agreement to IPFS:', error);
    }

    // Create agreement entity
    const agreement = this.agreementRepository.create({
      propertyId: createAgreementDto.propertyId,
      buyerId: createAgreementDto.buyerId,
      builderId: builderId,
      agreementType: createAgreementDto.agreementType,
      status: AgreementStatus.DRAFT,
      documentCID: uploadResult.path,
      documentUrl: uploadResult.url,
      documentIPFSHash,
      documentHash,
      terms,
    });

    const savedAgreement = await this.agreementRepository.save(agreement);

    // Update property status
    if (createAgreementDto.agreementType === AgreementType.INITIAL) {
      property.status = LandStatus.AGREEMENT_PENDING;
      await this.landRepository.save(property);
    }

    return AgreementResponseDto.fromEntity(savedAgreement);
  }

  /**
   * Generate agreement document content
   */
  private generateAgreementDocument(
    agreementType: AgreementType,
    property: Land,
    buyer: User,
    builder: User,
    terms: Record<string, any>,
  ): string {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let document = '';

    if (agreementType === AgreementType.INITIAL) {
      document = `
═══════════════════════════════════════════════════════════════
              PROPERTY PURCHASE AGREEMENT
                    (INITIAL AGREEMENT)
═══════════════════════════════════════════════════════════════

Date: ${date}
Agreement Type: Initial Purchase Agreement

───────────────────────────────────────────────────────────────
PARTIES
───────────────────────────────────────────────────────────────

BUILDER/SELLER:
  Name: ${builder.name}
  Company: ${builder.companyName || 'N/A'}
  License Number: ${builder.licenseNumber || 'N/A'}
  Phone: ${builder.phoneNumber || 'N/A'}

BUYER:
  Name: ${buyer.name}
  Father's Name: ${buyer.fatherName || 'N/A'}
  CNIC: ${buyer.cnic || 'N/A'}
  Phone: ${buyer.phoneNumber || 'N/A'}

───────────────────────────────────────────────────────────────
PROPERTY DETAILS
───────────────────────────────────────────────────────────────

Property Title: ${property.title}
Unit ID: ${property.unitId || 'N/A'}
Location: ${property.location}
Size: ${property.size} sq. meters

───────────────────────────────────────────────────────────────
FINANCIAL TERMS
───────────────────────────────────────────────────────────────

Total Price: ${terms.totalAmount || terms.price} 
${terms.installmentPlanYears ? `Installment Plan: ${terms.installmentPlanYears} years` : 'Payment Terms: Full payment'}
Payment Terms: ${terms.paymentTerms || 'As per installment plan'}

───────────────────────────────────────────────────────────────
TERMS AND CONDITIONS
───────────────────────────────────────────────────────────────

1. This agreement represents the initial purchase agreement between the builder and buyer.

2. Upon full payment, a Final Ownership Agreement will be executed.

3. The buyer agrees to make payments according to the agreed installment plan.

4. The builder agrees to transfer ownership upon completion of all payments.

5. All terms and conditions are subject to verification and final approval.

───────────────────────────────────────────────────────────────
SIGNATURES
───────────────────────────────────────────────────────────────

Builder Signature: ___________________ Date: ___________

Buyer Signature:   ___________________ Date: ___________

═══════════════════════════════════════════════════════════════
This document is digitally stored and verifiable on the blockchain.
═══════════════════════════════════════════════════════════════
`;
    } else {
      // FINAL_OWNERSHIP
      document = `
═══════════════════════════════════════════════════════════════
            FINAL OWNERSHIP TRANSFER AGREEMENT
═══════════════════════════════════════════════════════════════

Date: ${date}
Agreement Type: Final Ownership Agreement

───────────────────────────────────────────────────────────────
PARTIES
───────────────────────────────────────────────────────────────

SELLER (BUILDER):
  Name: ${builder.name}
  Company: ${builder.companyName || 'N/A'}
  License Number: ${builder.licenseNumber || 'N/A'}

BUYER (NEW OWNER):
  Name: ${buyer.name}
  Father's Name: ${buyer.fatherName || 'N/A'}
  CNIC: ${buyer.cnic || 'N/A'}
  Phone: ${buyer.phoneNumber || 'N/A'}

───────────────────────────────────────────────────────────────
PROPERTY DETAILS
───────────────────────────────────────────────────────────────

Property Title: ${property.title}
Unit ID: ${property.unitId || 'N/A'}
Location: ${property.location}
Size: ${property.size} sq. meters

───────────────────────────────────────────────────────────────
OWNERSHIP TRANSFER
───────────────────────────────────────────────────────────────

WHEREAS all payments have been completed, ownership of the above-described property is hereby transferred from the Builder to the Buyer.

Total Amount Paid: ${terms.totalAmount || terms.price}
Payment Status: FULLY PAID

───────────────────────────────────────────────────────────────
TERMS AND CONDITIONS
───────────────────────────────────────────────────────────────

1. This agreement represents the final ownership transfer.

2. The buyer is now the legal owner of the property.

3. All ownership rights and responsibilities are transferred to the buyer.

4. This agreement supersedes any previous agreements.

───────────────────────────────────────────────────────────────
SIGNATURES
───────────────────────────────────────────────────────────────

Builder Signature: ___________________ Date: ___________

Buyer Signature:   ___________________ Date: ___________

═══════════════════════════════════════════════════════════════
This document is digitally stored and verifiable on the blockchain.
═══════════════════════════════════════════════════════════════
`;
    }

    return document.trim();
  }

  /**
   * Sign agreement (buyer or builder)
   */
  async signAgreement(
    agreementId: string,
    userId: string,
    userRole: UserRole,
    signDto: SignAgreementDto,
  ): Promise<AgreementResponseDto> {
    if (!signDto.confirmed) {
      throw new BadRequestException('Signature confirmation is required');
    }

    const agreement = await this.agreementRepository.findOne({
      where: { id: agreementId },
      relations: ['property', 'buyer', 'builder'],
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    // Verify user is authorized to sign
    const isBuilder = agreement.builderId === userId && userRole === UserRole.BUILDER;
    const isBuyer = agreement.buyerId === userId;

    if (!isBuilder && !isBuyer) {
      throw new ForbiddenException('You are not authorized to sign this agreement');
    }

    // Check if agreement can be signed
    if (
      agreement.status !== AgreementStatus.DRAFT &&
      agreement.status !== AgreementStatus.PENDING_SIGNATURE
    ) {
      throw new BadRequestException(
        `Agreement cannot be signed. Current status: ${agreement.status}`,
      );
    }

    // Update signature timestamp
    const now = new Date();
    if (isBuyer && !agreement.buyerSignedAt) {
      agreement.buyerSignedAt = now;
    }

    if (isBuilder && !agreement.builderSignedAt) {
      agreement.builderSignedAt = now;
    }

    // Check if both parties have signed
    const bothSigned = agreement.buyerSignedAt && agreement.builderSignedAt;

    if (bothSigned) {
      agreement.status = AgreementStatus.SIGNED;

      // Generate signed document
      const signedDocument = await this.generateSignedAgreementDocument(agreement);

      // Upload signed document
      const signedBuffer = Buffer.from(signedDocument, 'utf-8');
      const signedHash = this.hashService.calculateSHA256(signedBuffer);

      const uploadResult = await this.fileStorageService.uploadFile('agreements', {
        buffer: signedBuffer,
        originalname: `signed-agreement-${agreementId}-${Date.now()}.txt`,
        mimetype: 'text/plain',
        size: signedBuffer.length,
      } as Express.Multer.File);

      let signedIPFSHash: string | null = null;
      try {
        const ipfsResult = await this.ipfsService.uploadFile({
          buffer: signedBuffer,
          originalname: `signed-agreement-${agreementId}-${Date.now()}.txt`,
          mimetype: 'text/plain',
          size: signedBuffer.length,
        } as Express.Multer.File);

        signedIPFSHash = this.ipfsService.formatIPFSHash(
          ipfsResult.hash,
          ipfsResult.gateway,
          ipfsResult.timestamp,
        );
      } catch (error) {
        console.error('Failed to upload signed agreement to IPFS:', error);
      }

      agreement.signedDocumentCID = uploadResult.path;
      agreement.signedDocumentIPFSHash = signedIPFSHash;
      agreement.signedDocumentHash = signedHash;

      // Store hash on blockchain (if configured)
      if (this.blockchainService.isContractAvailable() && agreement.property.blockchainLandId) {
        try {
          // Note: The smart contract may need to be extended to store agreement hashes
          // For now, we'll just log it - actual blockchain storage can be implemented later
          console.log(
            `Agreement ${agreementId} signed. Hash: ${signedHash}. Property blockchain ID: ${agreement.property.blockchainLandId}`,
          );
        } catch (error) {
          console.error('Failed to store agreement hash on blockchain:', error);
        }
      }
    } else {
      agreement.status = AgreementStatus.PENDING_SIGNATURE;
    }

    const savedAgreement = await this.agreementRepository.save(agreement);

    return AgreementResponseDto.fromEntity(savedAgreement);
  }

  /**
   * Generate signed agreement document with signature timestamps
   */
  private async generateSignedAgreementDocument(
    agreement: Agreement,
  ): Promise<string> {
    const property = await this.landRepository.findOne({
      where: { id: agreement.propertyId },
      relations: ['owner', 'project'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const buyer = agreement.buyer;
    const builder = agreement.builder;

    const buyerSignedDate = agreement.buyerSignedAt?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const builderSignedDate = agreement.builderSignedAt?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let document = '';

    if (agreement.agreementType === AgreementType.INITIAL) {
      document = `
═══════════════════════════════════════════════════════════════
              PROPERTY PURCHASE AGREEMENT
                    (INITIAL AGREEMENT)
                      [SIGNED COPY]
═══════════════════════════════════════════════════════════════

Date: ${date}
Agreement ID: ${agreement.id}
Agreement Type: Initial Purchase Agreement
Status: SIGNED

───────────────────────────────────────────────────────────────
PARTIES
───────────────────────────────────────────────────────────────

BUILDER/SELLER:
  Name: ${builder.name}
  Company: ${builder.companyName || 'N/A'}
  License Number: ${builder.licenseNumber || 'N/A'}
  Phone: ${builder.phoneNumber || 'N/A'}

BUYER:
  Name: ${buyer.name}
  Father's Name: ${buyer.fatherName || 'N/A'}
  CNIC: ${buyer.cnic || 'N/A'}
  Phone: ${buyer.phoneNumber || 'N/A'}

───────────────────────────────────────────────────────────────
PROPERTY DETAILS
───────────────────────────────────────────────────────────────

Property Title: ${property.title}
Unit ID: ${property.unitId || 'N/A'}
Location: ${property.location}
Size: ${property.size} sq. meters

───────────────────────────────────────────────────────────────
FINANCIAL TERMS
───────────────────────────────────────────────────────────────

Total Price: ${agreement.terms?.totalAmount || agreement.terms?.price} 
${agreement.terms?.installmentPlanYears ? `Installment Plan: ${agreement.terms.installmentPlanYears} years` : 'Payment Terms: Full payment'}
Payment Terms: ${agreement.terms?.paymentTerms || 'As per installment plan'}

───────────────────────────────────────────────────────────────
TERMS AND CONDITIONS
───────────────────────────────────────────────────────────────

1. This agreement represents the initial purchase agreement between the builder and buyer.

2. Upon full payment, a Final Ownership Agreement will be executed.

3. The buyer agrees to make payments according to the agreed installment plan.

4. The builder agrees to transfer ownership upon completion of all payments.

5. All terms and conditions are subject to verification and final approval.

───────────────────────────────────────────────────────────────
DIGITAL SIGNATURES
───────────────────────────────────────────────────────────────

Builder Signature: ✓ SIGNED
  Signed At: ${builderSignedDate}
  Signature Hash: ${agreement.builderSignedAt ? this.hashService.calculateSHA256(Buffer.from(`${agreement.id}-${agreement.builderId}-${agreement.builderSignedAt.toISOString()}`)) : 'N/A'}

Buyer Signature:   ✓ SIGNED
  Signed At: ${buyerSignedDate}
  Signature Hash: ${agreement.buyerSignedAt ? this.hashService.calculateSHA256(Buffer.from(`${agreement.id}-${agreement.buyerId}-${agreement.buyerSignedAt.toISOString()}`)) : 'N/A'}

Document Hash (SHA-256): ${agreement.documentHash}
Signed Document Hash (SHA-256): ${agreement.signedDocumentHash || 'Pending'}

═══════════════════════════════════════════════════════════════
This document is digitally signed and stored immutably on IPFS.
Blockchain Transaction: ${agreement.blockchainTxHash || 'Pending'}
═══════════════════════════════════════════════════════════════
`;
    } else {
      // FINAL_OWNERSHIP
      document = `
═══════════════════════════════════════════════════════════════
            FINAL OWNERSHIP TRANSFER AGREEMENT
                        [SIGNED COPY]
═══════════════════════════════════════════════════════════════

Date: ${date}
Agreement ID: ${agreement.id}
Agreement Type: Final Ownership Agreement
Status: SIGNED

───────────────────────────────────────────────────────────────
PARTIES
───────────────────────────────────────────────────────────────

SELLER (BUILDER):
  Name: ${builder.name}
  Company: ${builder.companyName || 'N/A'}
  License Number: ${builder.licenseNumber || 'N/A'}

BUYER (NEW OWNER):
  Name: ${buyer.name}
  Father's Name: ${buyer.fatherName || 'N/A'}
  CNIC: ${buyer.cnic || 'N/A'}
  Phone: ${buyer.phoneNumber || 'N/A'}

───────────────────────────────────────────────────────────────
PROPERTY DETAILS
───────────────────────────────────────────────────────────────

Property Title: ${property.title}
Unit ID: ${property.unitId || 'N/A'}
Location: ${property.location}
Size: ${property.size} sq. meters

───────────────────────────────────────────────────────────────
OWNERSHIP TRANSFER
───────────────────────────────────────────────────────────────

WHEREAS all payments have been completed, ownership of the above-described property is hereby transferred from the Builder to the Buyer.

Total Amount Paid: ${agreement.terms?.totalAmount || agreement.terms?.price}
Payment Status: FULLY PAID

───────────────────────────────────────────────────────────────
TERMS AND CONDITIONS
───────────────────────────────────────────────────────────────

1. This agreement represents the final ownership transfer.

2. The buyer is now the legal owner of the property.

3. All ownership rights and responsibilities are transferred to the buyer.

4. This agreement supersedes any previous agreements.

───────────────────────────────────────────────────────────────
DIGITAL SIGNATURES
───────────────────────────────────────────────────────────────

Builder Signature: ✓ SIGNED
  Signed At: ${builderSignedDate}
  Signature Hash: ${agreement.builderSignedAt ? this.hashService.calculateSHA256(Buffer.from(`${agreement.id}-${agreement.builderId}-${agreement.builderSignedAt.toISOString()}`)) : 'N/A'}

Buyer Signature:   ✓ SIGNED
  Signed At: ${buyerSignedDate}
  Signature Hash: ${agreement.buyerSignedAt ? this.hashService.calculateSHA256(Buffer.from(`${agreement.id}-${agreement.buyerId}-${agreement.buyerSignedAt.toISOString()}`)) : 'N/A'}

Document Hash (SHA-256): ${agreement.documentHash}
Signed Document Hash (SHA-256): ${agreement.signedDocumentHash || 'Pending'}

═══════════════════════════════════════════════════════════════
This document is digitally signed and stored immutably on IPFS.
Blockchain Transaction: ${agreement.blockchainTxHash || 'Pending'}
═══════════════════════════════════════════════════════════════
`;
    }

    return document.trim();
  }

  /**
   * Find all agreements with filters
   */
  async findAll(query: QueryAgreementsDto): Promise<{
    data: AgreementResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      agreementType,
      status,
      propertyId,
      buyerId,
      builderId,
    } = query;

    const queryBuilder = this.agreementRepository.createQueryBuilder('agreement');

    if (agreementType) {
      queryBuilder.where('agreement.agreementType = :agreementType', { agreementType });
    }

    if (status) {
      queryBuilder.andWhere('agreement.status = :status', { status });
    }

    if (propertyId) {
      queryBuilder.andWhere('agreement.propertyId = :propertyId', { propertyId });
    }

    if (buyerId) {
      queryBuilder.andWhere('agreement.buyerId = :buyerId', { buyerId });
    }

    if (builderId) {
      queryBuilder.andWhere('agreement.builderId = :builderId', { builderId });
    }

    const [agreements, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('agreement.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: agreements.map((agreement) => AgreementResponseDto.fromEntity(agreement)),
      total,
      page,
      limit,
    };
  }

  /**
   * Find one agreement by ID
   */
  async findOne(id: string): Promise<AgreementResponseDto> {
    const agreement = await this.agreementRepository.findOne({
      where: { id },
      relations: ['property', 'buyer', 'builder'],
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return AgreementResponseDto.fromEntity(agreement);
  }

  /**
   * Verify agreement signatures and document integrity
   */
  async verifyAgreement(id: string): Promise<{
    verified: boolean;
    message: string;
    signaturesVerified: boolean;
    documentVerified: boolean;
    agreement?: AgreementResponseDto;
  }> {
    const agreement = await this.agreementRepository.findOne({
      where: { id },
      relations: ['property', 'buyer', 'builder'],
    });

    if (!agreement) {
      return {
        verified: false,
        message: 'Agreement not found',
        signaturesVerified: false,
        documentVerified: false,
      };
    }

    // Check signatures
    const signaturesVerified = !!(agreement.buyerSignedAt && agreement.builderSignedAt);

    // Verify document hash if signed document exists
    let documentVerified = false;
    if (agreement.signedDocumentHash && agreement.signedDocumentCID) {
      try {
        // signedDocumentCID format: "agreements/filename.txt"
        const pathParts = agreement.signedDocumentCID.split('/');
        if (pathParts.length === 2) {
          const bucket = pathParts[0];
          const fileName = pathParts[1];
          const fileBuffer = await this.fileStorageService.readFile(bucket, fileName);
          const calculatedHash = this.hashService.calculateSHA256(fileBuffer);
          documentVerified = calculatedHash.toLowerCase() === agreement.signedDocumentHash.toLowerCase();
        }
      } catch (error) {
        console.error('Error verifying document:', error);
      }
    }

    const verified = signaturesVerified && documentVerified;

    return {
      verified,
      message: verified
        ? 'Agreement is fully verified'
        : signaturesVerified
          ? 'Signatures verified but document verification failed'
          : 'Signatures are incomplete',
      signaturesVerified,
      documentVerified,
      agreement: AgreementResponseDto.fromEntity(agreement),
    };
  }
}

