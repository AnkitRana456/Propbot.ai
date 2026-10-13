import { z } from 'zod';
import {
  permissionSchema,
  tenantContextSchema,
  userRoleSchema,
  userStatusSchema,
  registerCompanySchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.js';

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type TenantContext = z.infer<typeof tenantContextSchema>;

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
