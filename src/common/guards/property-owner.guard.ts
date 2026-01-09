import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Land } from '../../entities/land.entity';

@Injectable()
export class PropertyOwnerGuard implements CanActivate {
  constructor(
    @InjectRepository(Land)
    private landRepository: Repository<Land>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = request.user as User | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin has access to everything
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Get property ID from route parameters (supports both 'propertyId' and 'landId')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const propertyId: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.params?.propertyId ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.params?.landId ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      request.params?.id;

    if (!propertyId) {
      throw new ForbiddenException(
        'Property ID is required. Use route parameter: propertyId, landId, or id',
      );
    }

    // Fetch property from database
    const property = await this.landRepository.findOne({
      where: { id: propertyId },
      select: ['id', 'ownerId', 'status'],
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check if user is the owner
    if (property.ownerId !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this property. Only the property owner can perform this action.',
      );
    }

    return true;
  }
}
