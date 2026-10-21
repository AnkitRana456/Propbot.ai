import type { Permission, UserRole } from '@propbot/shared';
import { hasPermission } from '@propbot/shared';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  ClipboardList,
  Contact2,
  CreditCard,
  Database,
  GitBranch,
  HelpCircle,
  Inbox as InboxIcon,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Plug,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  Webhook,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Sidebar groups. CORE is the daily workspace; the rest can be collapsed. */
export type NavSection = 'CORE' | 'ENGAGE' | 'SELL' | 'GROW' | 'ADMIN';

export const NAV_SECTION_LABEL: Record<NavSection, string> = {
  CORE: 'Workspace',
  ENGAGE: 'Conversations & AI',
  SELL: 'Sales',
  GROW: 'Automation & insight',
  ADMIN: 'Admin',
};

export interface NavItemConfig {
  label: string;
  path: string;
  icon: LucideIcon;
  section: NavSection;
  badge?: string;
  requiredPermission?: Permission;
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  // Workspace: the screens used every day
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, section: 'CORE' },
  { label: 'Leads', path: '/leads', icon: Users, section: 'CORE', requiredPermission: 'view_leads' },
  { label: 'Clients', path: '/clients', icon: Contact2, section: 'CORE', requiredPermission: 'view_leads' },
  { label: 'Appointments', path: '/appointments', icon: Calendar, section: 'CORE', requiredPermission: 'view_leads' },
  { label: 'Chatbots', path: '/chatbots', icon: Bot, section: 'CORE', requiredPermission: 'manage_chatbots' },
  { label: 'WhatsApp Bot', path: '/whatsapp', icon: MessageSquare, section: 'CORE', badge: 'Live', requiredPermission: 'manage_chatbots' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, section: 'CORE', requiredPermission: 'view_analytics' },

  // Conversations & AI
  { label: 'Inbox', path: '/inbox', icon: InboxIcon, section: 'ENGAGE', requiredPermission: 'view_leads' },
  { label: 'Voice', path: '/voice', icon: PhoneCall, section: 'ENGAGE', requiredPermission: 'manage_chatbots' },
  { label: 'Channels', path: '/channels', icon: Plug, section: 'ENGAGE', requiredPermission: 'manage_chatbots' },
  { label: 'AI Agents', path: '/agents', icon: Sparkles, section: 'ENGAGE', requiredPermission: 'manage_chatbots' },
  { label: 'Tools', path: '/tools', icon: Wrench, section: 'ENGAGE', requiredPermission: 'manage_chatbots' },
  { label: 'Forms', path: '/forms', icon: ClipboardList, section: 'ENGAGE', requiredPermission: 'manage_chatbots' },

  // Sales
  { label: 'Properties', path: '/properties', icon: Building2, section: 'SELL', requiredPermission: 'view_inventory' },
  { label: 'Lead sources', path: '/lead-sources', icon: Radio, section: 'SELL', requiredPermission: 'manage_chatbots' },
  { label: 'Boards', path: '/boards', icon: KanbanSquare, section: 'SELL', requiredPermission: 'view_leads' },
  { label: 'Campaigns', path: '/campaigns', icon: Megaphone, section: 'SELL', requiredPermission: 'manage_chatbots' },

  // Automation & insight
  { label: 'Flows', path: '/flows', icon: GitBranch, section: 'GROW', requiredPermission: 'manage_workflows' },
  { label: 'Executions', path: '/executions', icon: Activity, section: 'GROW', requiredPermission: 'manage_workflows' },
  { label: 'Workflows', path: '/workflows', icon: Workflow, section: 'GROW', requiredPermission: 'manage_workflows' },
  { label: 'Data & insights', path: '/data', icon: Database, section: 'GROW', requiredPermission: 'view_leads' },
  { label: 'Dashboards', path: '/dashboards', icon: LayoutDashboard, section: 'GROW', requiredPermission: 'view_analytics' },

  // Admin
  { label: 'Approvals', path: '/approvals', icon: UserCheck, section: 'ADMIN', requiredPermission: 'approve_ai_actions' },
  { label: 'Webhook Logs', path: '/webhook-logs', icon: Webhook, section: 'ADMIN', requiredPermission: 'manage_settings' },
  { label: 'Users', path: '/users', icon: Users, section: 'ADMIN', requiredPermission: 'manage_users' },
  { label: 'Subscription', path: '/subscription', icon: CreditCard, section: 'ADMIN', requiredPermission: 'manage_billing' },
  { label: 'Payments & credits', path: '/billing', icon: Wallet, section: 'ADMIN', requiredPermission: 'manage_billing' },
  { label: 'Security & compliance', path: '/controls', icon: ShieldCheck, section: 'ADMIN', requiredPermission: 'manage_settings' },
  { label: 'Settings', path: '/settings', icon: Settings, section: 'ADMIN', requiredPermission: 'manage_settings' },
  { label: 'Help & Support', path: '/help', icon: HelpCircle, section: 'ADMIN' },
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

/** Breadcrumb trail for a path: section name, then the page. Falls back to the first path segment. */
export function breadcrumbFor(pathname: string): Array<{ label: string; to?: string }> {
  const item = NAVIGATION_ITEMS.find(i => pathname === i.path || pathname.startsWith(`${i.path}/`));
  if (!item) {
    const first = pathname.split('/').filter(Boolean)[0];
    return first ? [{ label: first.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()) }] : [{ label: 'Overview' }];
  }
  const trail: Array<{ label: string; to?: string }> = [];
  if (item.section !== 'CORE') trail.push({ label: NAV_SECTION_LABEL[item.section] });
  const deeper = pathname !== item.path;
  trail.push({ label: item.label, to: deeper ? item.path : undefined });
  if (deeper) trail.push({ label: 'Details' });
  return trail;
}
