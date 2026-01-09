import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class BuilderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = request.user as User | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role !== UserRole.BUILDER) {
      throw new ForbiddenException('Only builders can access this resource');
    }

    return true;
  }
}
