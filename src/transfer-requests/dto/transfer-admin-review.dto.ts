import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TransferAdminAction {
    APPROVE = 'approve',
    REJECT = 'reject',
}

export class TransferAdminReviewDto {
    @IsEnum(TransferAdminAction)
    action: TransferAdminAction;

    @IsOptional()
    @IsString()
    adminNotes?: string;

    @IsOptional()
    @IsString()
    rejectionReason?: string; // Required if action is REJECT
}
