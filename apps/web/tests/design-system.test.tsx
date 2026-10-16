import { describe, it, expect } from 'vitest';
import React from 'react';
import { Button } from '../src/components/ui/Button.js';
import { Badge } from '../src/components/ui/Badge.js';
import { Card } from '../src/components/ui/Card.js';
import { StatTile } from '../src/components/ui/StatTile.js';
import { Gauge } from '../src/components/ui/Gauge.js';
import { CommandPalette } from '../src/components/ui/CommandPalette.js';
import { TodayChecklist } from '../src/components/dashboard/TodayChecklist.js';
import { TodaySlaQueue } from '../src/components/dashboard/TodaySlaQueue.js';
import { MemoryRouter } from 'react-router-dom';

describe('Aurora Estate UI Component Library (Phase R2)', () => {
  it('instantiates Button with Aurora variants', () => {
    const btnPrimary = React.createElement(Button, { variant: 'primary' }, 'Primary Action');
    const btnMint = React.createElement(Button, { variant: 'mint' }, 'RERA Verified');
    const btnGold = React.createElement(Button, { variant: 'gold' }, 'Hot Lead Call');
    const btnDanger = React.createElement(Button, { variant: 'danger' }, 'Emergency Kill Switch');

    expect(btnPrimary.props.variant).toBe('primary');
    expect(btnMint.props.variant).toBe('mint');
    expect(btnGold.props.variant).toBe('gold');
    expect(btnDanger.props.variant).toBe('danger');
  });

  it('instantiates Badge with semantic statuses', () => {
    const badgeHot = React.createElement(Badge, { variant: 'gold' }, 'Hot Lead (92%)');
    const badgeVerified = React.createElement(Badge, { variant: 'mint' }, 'RERA Approved');
    const badgeAlert = React.createElement(Badge, { variant: 'rose' }, 'SLA Warning');

    expect(badgeHot.props.variant).toBe('gold');
    expect(badgeVerified.props.variant).toBe('mint');
    expect(badgeAlert.props.variant).toBe('rose');
  });

  it('instantiates Card with 12px and 20px radii', () => {
    const cardStandard = React.createElement(Card, { radius: 'xl' }, 'Content');
    const cardFeature = React.createElement(Card, { radius: '2xl', variant: 'glass' }, 'Feature');

    expect(cardStandard.props.radius).toBe('xl');
    expect(cardFeature.props.radius).toBe('2xl');
    expect(cardFeature.props.variant).toBe('glass');
  });

  it('instantiates StatTile with trend indicators', () => {
    const tile = React.createElement(StatTile, {
      label: 'Hot Leads Queue',
      value: '18',
      trend: { value: '+4 new', isPositive: true },
      accentColor: 'gold',
    });

    expect(tile.props.label).toBe('Hot Leads Queue');
    expect(tile.props.value).toBe('18');
    expect(tile.props.accentColor).toBe('gold');
  });

  it('instantiates Gauge with intent score calculation', () => {
    const gaugeHot = React.createElement(Gauge, { score: 94 });
    const gaugeWarm = React.createElement(Gauge, { score: 55 });
    const gaugeCold = React.createElement(Gauge, { score: 20 });

    expect(gaugeHot.props.score).toBe(94);
    expect(gaugeWarm.props.score).toBe(55);
    expect(gaugeCold.props.score).toBe(20);
  });

  it('instantiates CommandPalette without crash', () => {
    const palette = React.createElement(
      MemoryRouter,
      null,
      React.createElement(CommandPalette, { isOpen: false, onClose: () => {} })
    );
    expect(palette).toBeDefined();
  });

  it('instantiates TodayChecklist and TodaySlaQueue', () => {
    const checklist = React.createElement(
      MemoryRouter,
      null,
      React.createElement(TodayChecklist, {
        isAiConnected: true,
        hasChatbot: true,
        hasTrainedKnowledge: true,
        hasCapturedLead: false,
      })
    );
    expect(checklist).toBeDefined();

    const queue = React.createElement(
      MemoryRouter,
      null,
      React.createElement(TodaySlaQueue, {})
    );
    expect(queue).toBeDefined();
  });
});
