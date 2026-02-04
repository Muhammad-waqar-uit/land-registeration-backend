import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum AdminReviewAction {
    APPROVE = 'approve',
    REJECT = 'reject',
}

export class AdminReviewDto {
    @IsEnum(AdminReviewAction)
    action: AdminReviewAction;

    @IsOptional()
    @IsString()
    adminNotes?: string;

    @IsOptional()
    @IsString()
    rejectionReason?: string; // Required if action is REJECT
}
