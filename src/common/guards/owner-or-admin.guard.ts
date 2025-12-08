import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { User } from '../../entities/user.entity';

@Injectable()
export class OwnerOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    const resource = request.resource;

    if (!resource) {
      throw new ForbiddenException('Resource not found');
    }

    // Admin has access to everything
    if (user.role === 'admin') {
      return true;
    }

    // Check if user is the owner
    const ownerId = resource.ownerId || resource.userId;
    if (user.id === ownerId) {
      return true;
    }

    throw new ForbiddenException('You do not have permission to access this resource');
  }
}
