import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);
  private pinata: PinataSDK | null = null;

  constructor(private configService: ConfigService) {
    const jwt = this.configService.get<string>('PINATA_JWT');
    const gateway = this.configService.get<string>('PINATA_GATEWAY');

    if (jwt) {
      try {
        // Initialize Pinata SDK with JWT (gateway is optional)
        const config: { pinataJwt: string; pinataGateway?: string } = {
          pinataJwt: jwt,
        };

        if (gateway) {
          config.pinataGateway = gateway;
        }

        this.pinata = new PinataSDK(config);
        this.logger.log('IPFS service initialized with Pinata');
      } catch (error) {
        this.logger.error('Failed to initialize Pinata SDK:', error);
      }
    } else {
      this.logger.warn(
        'PINATA_JWT not configured, IPFS uploads will be disabled',
      );
    }
  }

  /**
   * Upload file to IPFS using Pinata
   * @param file - Multer file object
   * @returns IPFS hash (CID) and gateway URL
   */
  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ hash: string; gateway: string; timestamp: string }> {
    if (!this.pinata) {
      throw new Error(
        'IPFS service not configured. Please set PINATA_JWT in environment variables.',
      );
    }

    try {
      // Convert Multer buffer to File object for Pinata SDK
      // Create a new Uint8Array from the buffer (compatible with File constructor)
      const uint8Array = new Uint8Array(file.buffer);

      // Create File object (Web API standard) from buffer
      // Using type assertion as File constructor accepts Uint8Array at runtime
      const fileObj = new File([uint8Array as BlobPart], file.originalname, {
        type: file.mimetype || 'application/octet-stream',
      });

      // Upload to public IPFS network (publicly accessible)
      const upload = await this.pinata.upload.public.file(fileObj);

      const hash = upload.cid;
      const gateway = this.configService.get<string>('PINATA_GATEWAY')
        ? `https://${this.configService.get<string>('PINATA_GATEWAY')}/ipfs/`
        : 'https://gateway.pinata.cloud/ipfs/';
      const timestamp = new Date().toISOString();

      this.logger.log(`File uploaded to IPFS with CID: ${hash}`);

      return {
        hash,
        gateway,
        timestamp,
      };
    } catch (error) {
      this.logger.error('IPFS upload failed:', error);
      throw new Error(
        `Failed to upload file to IPFS: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get IPFS file URL
   * @param hash - IPFS hash (CID)
   * @returns Full URL to access the file
   */
  async getFileUrl(hash: string): Promise<string> {
    if (!this.pinata) {
      return `https://gateway.pinata.cloud/ipfs/${hash}`;
    }

    try {
      // Use Pinata gateway conversion if available
      return await this.pinata.gateways.public.convert(hash);
    } catch (error) {
      // Fallback to standard gateway URL
      this.logger.error('Failed to get IPFS gateway URL:', error);
      return `https://gateway.pinata.cloud/ipfs/${hash}`;
    }
  }

  /**
   * Format IPFS hash as JSON string for database storage
   * @param hash - IPFS hash (CID)
   * @param gateway - IPFS gateway URL
   * @param timestamp - Upload timestamp
   * @returns JSON string
   */
  formatIPFSHash(hash: string, gateway: string, timestamp: string): string {
    return JSON.stringify({ hash, gateway, timestamp });
  }
}
