import { ApiProperty } from '@nestjs/swagger';
import { Reservation, ReservationStatus } from '../../entities/reservation.entity';

class LandInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  price: number;
}

class BuyerInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
}

export class ReservationResponseDto {
  @ApiProperty({ description: 'Reservation ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Land ID', example: 'uuid' })
  landId: string;

  @ApiProperty({ description: 'Buyer ID', example: 'uuid' })
  buyerId: string;

  @ApiProperty({ description: 'Reservation status', enum: ReservationStatus })
  status: ReservationStatus;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Land information', type: LandInfoDto, required: false })
  land?: LandInfoDto;

  @ApiProperty({ description: 'Buyer information', type: BuyerInfoDto, required: false })
  buyer?: BuyerInfoDto;

  static fromEntity(
    reservation: Reservation,
    includeRelations = false,
  ): ReservationResponseDto {
    const response: ReservationResponseDto = {
      id: reservation.id,
      landId: reservation.landId,
      buyerId: reservation.buyerId,
      status: reservation.status,
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt,
    };

    if (includeRelations) {
      if (reservation.land) {
        response.land = {
          id: reservation.land.id,
          title: reservation.land.title,
          location: reservation.land.location,
          price: parseFloat(reservation.land.price.toString()),
        };
      }

      if (reservation.buyer) {
        response.buyer = {
          id: reservation.buyer.id,
          name: reservation.buyer.name,
          email: reservation.buyer.email,
        };
      }
    }

    return response;
  }
}
