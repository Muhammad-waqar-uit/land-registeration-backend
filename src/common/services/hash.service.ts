import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class HashService {
  /**
   * Calculate SHA-256 hash of a file buffer
   * @param buffer - File buffer to hash
   * @returns SHA-256 hash in hexadecimal format
   */
  calculateSHA256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verify if a file buffer matches a stored hash
   * @param buffer - File buffer to verify
   * @param storedHash - Previously stored SHA-256 hash
   * @returns true if hash matches, false otherwise
   */
  verifyHash(buffer: Buffer, storedHash: string): boolean {
    const calculatedHash = this.calculateSHA256(buffer);
    return calculatedHash.toLowerCase() === storedHash.toLowerCase();
  }
}
