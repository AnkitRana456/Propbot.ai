import { describe, it, expect } from 'vitest';
import { NAVIGATION_ITEMS, isNavVisible } from '../src/config/navigation.js';

describe('Navigation & RBAC Filtering', () => {
  it('defines all 16 required navigation items', () => {
    expect(NAVIGATION_ITEMS).toHaveLength(16);
    const labels = NAVIGATION_ITEMS.map(i => i.label);
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Chatbots');
    expect(labels).toContain('WhatsApp Bot');
    expect(labels).toContain('Leads');
    expect(labels).toContain('Contacts');
    expect(labels).toContain('Properties');
    expect(labels).toContain('Appointments');
    expect(labels).toContain('Approvals');
    expect(labels).toContain('Analytics');
    expect(labels).toContain('Workflows');
    expect(labels).toContain('Campaigns');
    expect(labels).toContain('Webhook Logs');
    expect(labels).toContain('Users');
    expect(labels).toContain('Subscription');
    expect(labels).toContain('Settings');
    expect(labels).toContain('Help & Support');
  });

  it('allows company_admin to see all navigation items', () => {
    const visible = NAVIGATION_ITEMS.filter(item => isNavVisible('company_admin', item));
    expect(visible).toHaveLength(16);
  });

  it('allows super_admin to see all navigation items', () => {
    const visible = NAVIGATION_ITEMS.filter(item => isNavVisible('super_admin', item));
    expect(visible).toHaveLength(16);
  });

  it('allows sales_manager to see chatbots, leads, properties, appointments, contacts, workflows, campaigns, and analytics', () => {
    const visible = NAVIGATION_ITEMS.filter(item => isNavVisible('sales_manager', item));
    const labels = visible.map(i => i.label);

    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Chatbots');
    expect(labels).toContain('WhatsApp Bot');
    expect(labels).toContain('Leads');
    expect(labels).toContain('Contacts');
    expect(labels).toContain('Properties');
    expect(labels).toContain('Appointments');
    expect(labels).toContain('Approvals');
    expect(labels).toContain('Analytics');
    expect(labels).toContain('Workflows');
    expect(labels).toContain('Campaigns');
    expect(labels).toContain('Help & Support');

    expect(labels).toContain('Users');
    expect(labels).not.toContain('Subscription');
    expect(labels).not.toContain('Settings');
    expect(labels).not.toContain('Webhook Logs');
  });

  it('restricts agent role to leads, contacts, properties, appointments, dashboard, and support', () => {
    const visible = NAVIGATION_ITEMS.filter(item => isNavVisible('agent', item));
    const labels = visible.map(i => i.label);

    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Leads');
    expect(labels).toContain('Contacts');
    expect(labels).toContain('Properties');
    expect(labels).toContain('Appointments');
    expect(labels).toContain('Help & Support');

    expect(labels).not.toContain('Approvals');
    expect(labels).not.toContain('Chatbots');
    expect(labels).not.toContain('WhatsApp Bot');
    expect(labels).not.toContain('Analytics');
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Subscription');
    expect(labels).not.toContain('Settings');
    expect(labels).not.toContain('Webhook Logs');
  });

  it('restricts viewer role to read-only views', () => {
    const visible = NAVIGATION_ITEMS.filter(item => isNavVisible('viewer', item));
    const labels = visible.map(i => i.label);

    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Analytics');
    expect(labels).toContain('Properties');
    expect(labels).toContain('Help & Support');

    expect(labels).not.toContain('Approvals');
    expect(labels).not.toContain('Users');
    expect(labels).not.toContain('Subscription');
    expect(labels).not.toContain('Settings');
    expect(labels).not.toContain('Chatbots');
    expect(labels).not.toContain('WhatsApp Bot');
  });
});
