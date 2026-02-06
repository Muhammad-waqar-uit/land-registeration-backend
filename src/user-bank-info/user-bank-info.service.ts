import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBankInfo } from '../entities/user-bank-info.entity';
import { CreateUserBankInfoDto } from './dto/create-user-bank-info.dto';
import { UpdateUserBankInfoDto } from './dto/update-user-bank-info.dto';
import { UserBankInfoResponseDto } from './dto/user-bank-info-response.dto';

@Injectable()
export class UserBankInfoService {
  constructor(
    @InjectRepository(UserBankInfo)
    private readonly userBankInfoRepository: Repository<UserBankInfo>,
  ) {}

  async create(userId: string, dto: CreateUserBankInfoDto): Promise<UserBankInfoResponseDto> {
    const entity = this.userBankInfoRepository.create({
      userId,
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
    });
    const saved = await this.userBankInfoRepository.save(entity);
    return UserBankInfoResponseDto.fromEntity(saved);
  }

  async findAllByUser(userId: string): Promise<UserBankInfoResponseDto[]> {
    const list = await this.userBankInfoRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => UserBankInfoResponseDto.fromEntity(e));
  }

  async findOne(id: string, userId: string): Promise<UserBankInfoResponseDto> {
    const entity = await this.userBankInfoRepository.findOne({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException('Bank info not found');
    }
    if (entity.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return UserBankInfoResponseDto.fromEntity(entity);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateUserBankInfoDto,
  ): Promise<UserBankInfoResponseDto> {
    const entity = await this.userBankInfoRepository.findOne({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException('Bank info not found');
    }
    if (entity.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (dto.bankName !== undefined) entity.bankName = dto.bankName;
    if (dto.accountNumber !== undefined) entity.accountNumber = dto.accountNumber;
    const saved = await this.userBankInfoRepository.save(entity);
    return UserBankInfoResponseDto.fromEntity(saved);
  }

  async remove(id: string, userId: string): Promise<void> {
    const entity = await this.userBankInfoRepository.findOne({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException('Bank info not found');
    }
    if (entity.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.userBankInfoRepository.remove(entity);
  }
}
