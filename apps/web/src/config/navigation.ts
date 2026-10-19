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

export type NavSection = 'CORE' | 'ENGAGE' | 'SELL' | 'GROW' | 'ADMIN';

export interface NavItemConfig {
  label: string;
  path: string;
  icon: LucideIcon;
  section: NavSection;
  badge?: string;
  requiredPermission?: Permission;
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  // Core
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    section: 'CORE',
  },

  // ENGAGE: Chatbots, WhatsApp, Inbox
  {
    label: 'Chatbots',
    path: '/chatbots',
    icon: Bot,
    section: 'ENGAGE',
    requiredPermission: 'manage_chatbots',
  },
  {
    label: 'WhatsApp Bot',
    path: '/whatsapp',
    icon: MessageSquare,
    section: 'ENGAGE',
    badge: 'Live',
    requiredPermission: 'manage_chatbots',
  },

  // SELL: Leads, Pipeline, Appointments, Properties
  {
    label: 'Leads',
    path: '/leads',
    icon: Users,
    section: 'SELL',
    requiredPermission: 'view_leads',
  },
  {
    label: 'Contacts',
    path: '/contacts',
    icon: Contact2,
    section: 'SELL',
    requiredPermission: 'view_leads',
  },
  {
    label: 'Properties',
    path: '/properties',
    icon: Building2,
    section: 'SELL',
    requiredPermission: 'view_inventory',
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: Calendar,
    section: 'SELL',
    requiredPermission: 'view_leads',
  },

  // GROW: Campaigns, Workflows, Analytics
  {
    label: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    section: 'GROW',
    requiredPermission: 'manage_chatbots',
  },
  {
    label: 'Workflows',
    path: '/workflows',
    icon: Workflow,
    section: 'GROW',
    requiredPermission: 'manage_workflows',
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    section: 'GROW',
    requiredPermission: 'view_analytics',
  },

  // ADMIN: Approvals, Users, Subscription, Settings, Support
  {
    label: 'Approvals',
    path: '/approvals',
    icon: ShieldCheck,
    section: 'ADMIN',
    requiredPermission: 'approve_ai_actions',
  },
  {
    label: 'Users',
    path: '/users',
    icon: UserCheck,
    section: 'ADMIN',
    requiredPermission: 'manage_users',
  },
  {
    label: 'Subscription',
    path: '/subscription',
    icon: CreditCard,
    section: 'ADMIN',
    requiredPermission: 'manage_billing',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    section: 'ADMIN',
    requiredPermission: 'manage_settings',
  },
  {
    label: 'Webhook Logs',
    path: '/webhook-logs',
    icon: Webhook,
    section: 'ADMIN',
    requiredPermission: 'manage_settings',
  },
  {
    label: 'Help & Support',
    path: '/help',
    icon: HelpCircle,
    section: 'ADMIN',
  },
];

export function isNavVisible(role: UserRole, item: NavItemConfig): boolean {
  if (role === 'ps-owner') {
    return true;
  }
  if (!item.requiredPermission) {
    return true;
  }
  return hasPermission(role, item.requiredPermission);
}
