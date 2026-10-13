import type { Permission, UserRole } from '@propbot/shared';
import { hasPermission } from '@propbot/shared';
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Users,
  Contact2,
  Calendar,
  Building2,
  BarChart3,
  Webhook,
  UserCheck,
  CreditCard,
  Settings,
  HelpCircle,
  ShieldCheck,
  Workflow,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  requiredPermission?: Permission;
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Chatbots',
    path: '/chatbots',
    icon: Bot,
    requiredPermission: 'manage_chatbots',
  },
  {
    label: 'WhatsApp Bot',
    path: '/whatsapp',
    icon: MessageSquare,
    badge: 'New',
    requiredPermission: 'manage_chatbots',
  },
  {
    label: 'Leads',
    path: '/leads',
    icon: Users,
    badge: 'New',
    requiredPermission: 'view_leads',
  },
  {
    label: 'Contacts',
    path: '/contacts',
    icon: Contact2,
    requiredPermission: 'view_leads',
  },
  {
    label: 'Properties',
    path: '/properties',
    icon: Building2,
    badge: 'Live',
    requiredPermission: 'view_inventory',
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: Calendar,
    badge: 'New',
    requiredPermission: 'view_leads',
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    requiredPermission: 'view_analytics',
  },
  {
    label: 'Workflows',
    path: '/workflows',
    icon: Workflow,
    badge: 'Growth',
    requiredPermission: 'manage_workflows',
  },
  {
    label: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    badge: 'Growth',
    requiredPermission: 'manage_chatbots',
  },
  {
    label: 'Webhook Logs',
    path: '/webhook-logs',
    icon: Webhook,
    requiredPermission: 'manage_settings',
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: ShieldCheck,
    requiredPermission: 'approve_ai_actions',
  },
  {
    label: 'Users',
    path: '/users',
    icon: UserCheck,
    requiredPermission: 'manage_users',
  },
  {
    label: 'Subscription',
    path: '/subscription',
    icon: CreditCard,
    requiredPermission: 'manage_billing',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    requiredPermission: 'manage_settings',
  },
  {
    label: 'Help & Support',
    path: '/help',
    icon: HelpCircle,
  },
];

export function isNavVisible(role: UserRole, item: NavItemConfig): boolean {
  if (role === 'super_admin') {
    return true;
  }
  if (!item.requiredPermission) {
    return true;
  }
  return hasPermission(role, item.requiredPermission);
}
