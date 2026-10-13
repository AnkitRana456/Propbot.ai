import { z } from 'zod';

export const userRoleSchema = z.enum([
  'super_admin',
  'company_admin',
  'sales_manager',
  'agent',
  'viewer',
]);

export const userStatusSchema = z.enum(['active', 'pending_approval', 'disabled']);

export const permissionSchema = z.enum([
  'manage_company',
  'manage_users',
  'approve_users',
  'manage_chatbots',
  'train_chatbots',
  'view_leads',
  'edit_leads',
  'assign_leads',
  'delete_leads',
  'view_analytics',
  'manage_billing',
  'manage_settings',
  'approve_ai_actions',
  'manage_workflows',
  'view_inventory',
  'manage_inventory',
  'view_appointments',
  'manage_appointments',
  'view_webhooks',
  'manage_webhooks',
]);

export const tenantContextSchema = z.object({
  company_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: userRoleSchema,
  permissions: z.array(permissionSchema),
});

// Request Schemas
export const registerCompanySchema = z.object({
  companyName: z.string().min(2).max(100),
  companySlug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens'),
  adminName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  companySlug: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  allDevices: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

// Role Permissions Matrix
export const ROLE_PERMISSIONS: Record<
  z.infer<typeof userRoleSchema>,
  readonly z.infer<typeof permissionSchema>[]
> = {
  super_admin: [
    'manage_company',
    'manage_users',
    'approve_users',
    'manage_chatbots',
    'train_chatbots',
    'view_leads',
    'edit_leads',
    'assign_leads',
    'delete_leads',
    'view_analytics',
    'manage_billing',
    'manage_settings',
    'approve_ai_actions',
    'manage_workflows',
    'view_inventory',
    'manage_inventory',
    'view_appointments',
    'manage_appointments',
    'view_webhooks',
    'manage_webhooks',
  ],
  company_admin: [
    'manage_company',
    'manage_users',
    'approve_users',
    'manage_chatbots',
    'train_chatbots',
    'view_leads',
    'edit_leads',
    'assign_leads',
    'delete_leads',
    'view_analytics',
    'manage_billing',
    'manage_settings',
    'approve_ai_actions',
    'manage_workflows',
    'view_inventory',
    'manage_inventory',
    'view_appointments',
    'manage_appointments',
    'view_webhooks',
    'manage_webhooks',
  ],
  sales_manager: [
    'manage_users',
    'manage_chatbots',
    'train_chatbots',
    'view_leads',
    'edit_leads',
    'assign_leads',
    'view_analytics',
    'approve_ai_actions',
    'view_inventory',
    'manage_inventory',
    'view_appointments',
    'manage_appointments',
    'view_webhooks',
    'manage_workflows',
  ],
  agent: ['view_leads', 'edit_leads', 'view_inventory', 'view_appointments', 'manage_appointments'],
  viewer: ['view_leads', 'view_analytics', 'view_inventory', 'view_appointments'],
} as const;

export function hasPermission(
  role: z.infer<typeof userRoleSchema>,
  permission: z.infer<typeof permissionSchema>,
): boolean {
  const permissions = ROLE_PERMISSIONS[role] as readonly z.infer<typeof permissionSchema>[];
  return permissions.includes(permission);
}
