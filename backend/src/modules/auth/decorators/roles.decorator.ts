import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../common/enums';

export const ROLES_KEY = 'roles';

/** Marks a route as accessible only to the specified roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
