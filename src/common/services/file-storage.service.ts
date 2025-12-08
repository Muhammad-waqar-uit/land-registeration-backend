import { Injectable } from '@nestjs/common';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class FileStorageService {
  private readonly uploadDir: string;

  constructor() {
    // Store files in uploads directory
    this.uploadDir = join(process.cwd(), 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!existsSync(this.uploadDir)) {
      mkdir(this.uploadDir, { recursive: true }).catch(() => {
        // Directory creation will happen on first upload
      });
    }
  }

  async uploadFile(
    bucket: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; path: string }> {
    // Ensure uploads directory exists
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }

    // Create bucket subdirectory if needed
    const bucketDir = join(this.uploadDir, bucket);
    if (!existsSync(bucketDir)) {
      await mkdir(bucketDir, { recursive: true });
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = join(bucketDir, fileName);

    // Write file to disk
    await writeFile(filePath, file.buffer);

    // Return URL path (relative to uploads directory)
    const relativePath = `${bucket}/${fileName}`;
    const url = `/uploads/${relativePath}`;

    return {
      url,
      path: relativePath,
    };
  }

  async deleteFile(bucket: string, fileName: string): Promise<void> {
    const filePath = join(this.uploadDir, bucket, fileName);
    
    try {
      await unlink(filePath);
    } catch (error) {
      // File might not exist, that's okay
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete file: ${(error as Error).message}`);
      }
    }
  }

  async getPublicUrl(bucket: string, fileName: string): Promise<string> {
    return `/uploads/${bucket}/${fileName}`;
  }
}
