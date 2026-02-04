import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateOwnershipDocumentDto {
    @IsUUID()
    buyerId: string; // New owner/buyer

    @IsOptional()
    @IsString()
    notes?: string; // Builder's notes
}
