import { ApiProperty } from '@nestjs/swagger';

export class UserBankInfoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  bankName: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: {
    id: string;
    userId: string;
    bankName: string;
    accountNumber: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserBankInfoResponseDto {
    const dto = new UserBankInfoResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.bankName = entity.bankName;
    dto.accountNumber = entity.accountNumber;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
