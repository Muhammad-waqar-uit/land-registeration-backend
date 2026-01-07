import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from '../entities/reservation.entity';
import { Land, LandStatus } from '../entities/land.entity';
import { User } from '../entities/user.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';
import { BlockchainService } from '../common/services/blockchain.service';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private reservationRepository: Repository<Reservation>,
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private blockchainService: BlockchainService,
  ) {}

  async create(
    createReservationDto: CreateReservationDto,
    buyerId: string,
  ): Promise<ReservationResponseDto> {
    const { landId } = createReservationDto;

    // Verify land exists
    const land = await this.landRepository.findOne({
      where: { id: landId },
    });

    if (!land) {
      throw new NotFoundException('Land not found');
    }

    // Check if land is available
    if (land.status !== LandStatus.AVAILABLE) {
      throw new ConflictException('Land is not available for reservation');
    }

    // Check if user already has an active reservation for this land
    const existingReservation = await this.reservationRepository.findOne({
      where: {
        landId,
        buyerId,
        status: ReservationStatus.ACTIVE,
      },
    });

    if (existingReservation) {
      throw new ConflictException(
        'You already have an active reservation for this land',
      );
    }

    // Get buyer user to get wallet address
    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
      select: ['id', 'walletAddress'],
    });

    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    if (!buyer.walletAddress) {
      throw new ConflictException(
        'Buyer must have a wallet address to reserve land',
      );
    }

    // Lock the land on blockchain (if blockchain is configured and land is registered)
    if (
      this.blockchainService.isContractAvailable() &&
      land.blockchainLandId
    ) {
      try {
        const lockResult = await this.blockchainService.lockLandToBuyer(
          land.blockchainLandId,
          buyer.walletAddress,
        );

        if (!lockResult.success) {
          // Log error but don't fail the reservation
          console.error(
            'Failed to lock land on blockchain:',
            lockResult.error,
          );
        }
      } catch (error) {
        // Log error but don't fail the reservation
        console.error('Error locking land on blockchain:', error);
      }
    }

    // Lock the land in database
    land.status = LandStatus.LOCKED;
    await this.landRepository.save(land);

    // Create reservation
    const reservation = this.reservationRepository.create({
      landId,
      buyerId,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    const reservationWithRelations = await this.reservationRepository.findOne({
      where: { id: savedReservation.id },
      relations: ['land', 'buyer'],
    });

    if (!reservationWithRelations) {
      throw new NotFoundException('Reservation not found');
    }

    return ReservationResponseDto.fromEntity(
      reservationWithRelations,
      true,
    );
  }

  async cancel(id: string, userId: string): Promise<void> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['land'],
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    // Check if user owns the reservation or owns the land
    if (reservation.buyerId !== userId && reservation.land?.ownerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to cancel this reservation',
      );
    }

    if (reservation.status !== ReservationStatus.ACTIVE) {
      throw new ConflictException('Reservation is not active');
    }

    // Cancel reservation
    reservation.status = ReservationStatus.CANCELLED;
    await this.reservationRepository.save(reservation);

    // Unlock the land if no other active reservations exist
    if (reservation.land) {
      const activeReservations = await this.reservationRepository.count({
        where: {
          landId: reservation.landId,
          status: ReservationStatus.ACTIVE,
        },
      });

      if (activeReservations === 0 && reservation.land.status === LandStatus.LOCKED) {
        reservation.land.status = LandStatus.AVAILABLE;
        await this.landRepository.save(reservation.land);
      }
    }
  }

  async findReservationsForSeller(sellerId: string): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservationRepository
      .createQueryBuilder('reservation')
      .innerJoinAndSelect('reservation.land', 'land')
      .innerJoinAndSelect('reservation.buyer', 'buyer')
      .where('land.ownerId = :sellerId', { sellerId })
      .orderBy('reservation.createdAt', 'DESC')
      .getMany();

    return reservations.map((reservation) =>
      ReservationResponseDto.fromEntity(reservation, true),
    );
  }

  async findAll(buyerId?: string): Promise<ReservationResponseDto[]> {
    const where: any = {};
    if (buyerId) {
      where.buyerId = buyerId;
    }

    const reservations = await this.reservationRepository.find({
      where,
      relations: ['land', 'buyer'],
      order: { createdAt: 'DESC' },
    });

    return reservations.map((reservation) =>
      ReservationResponseDto.fromEntity(reservation, true),
    );
  }
}
