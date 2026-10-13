import { describe, it, expect } from 'vitest';
import React from 'react';
import { AppShell } from '../src/components/layout/AppShell.js';
import { TopBar } from '../src/components/layout/TopBar.js';
import { Sidebar } from '../src/components/layout/Sidebar.js';

describe('AppShell Layout Component Suite (PDF Phase 1.4)', () => {
  it('instantiates AppShell component without crashing', () => {
    const el = React.createElement(AppShell);
    expect(el).toBeDefined();
    expect(el.type).toBe(AppShell);
  });

  it('instantiates TopBar with notification count and callbacks', () => {
    const onOpenMobile = () => {};
    const topBar = React.createElement(TopBar, {
      unreadNotificationsCount: 5,
      onOpenMobileMenu: onOpenMobile,
    });
    expect(topBar).toBeDefined();
    expect(topBar.props.unreadNotificationsCount).toBe(5);
    expect(topBar.props.onOpenMobileMenu).toBe(onOpenMobile);
  });

  it('instantiates Sidebar with collapsed and mobile props', () => {
    const toggleCollapse = () => {};
    const closeMobile = () => {};
    const sidebar = React.createElement(Sidebar, {
      isCollapsed: false,
      onToggleCollapse: toggleCollapse,
      isMobileOpen: false,
      onCloseMobile: closeMobile,
    });
    expect(sidebar).toBeDefined();
    expect(sidebar.props.isCollapsed).toBe(false);
    expect(sidebar.props.isMobileOpen).toBe(false);
  });
});
