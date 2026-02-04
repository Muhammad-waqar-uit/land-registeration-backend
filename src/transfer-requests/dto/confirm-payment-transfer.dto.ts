import { IsBoolean, IsUUID, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentAndTransferDto {
    @IsUUID()
    newOwnerId: string; // Buyer who will receive ownership

    @IsBoolean()
    paymentConfirmed: boolean; // Seller confirms payment received

    @IsBoolean()
    allowDocumentChange: boolean; // Seller allows document transfer

    @IsOptional()
    @IsString()
    confirmationNotes?: string; // Seller's confirmation notes
}
