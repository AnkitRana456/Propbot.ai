import type { UserRole, UserStatus, Permission } from '@propbot/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        companyId: string;
        email: string;
        name: string;
        role: UserRole;
        status: UserStatus;
      };
      tenant?: {
        companyId: string;
        userId: string;
        role: UserRole;
        permissions: readonly Permission[];
      };
      companyId?: string;
    }
  }
}
