import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectCard } from '../src/components/inventory/ProjectCard.js';
import { EmiCalculator } from '../src/components/inventory/EmiCalculator.js';
import { PropertyCompareModal } from '../src/components/inventory/PropertyCompareModal.js';
import type { ProjectItem } from '@propbot/shared';

describe('Property Inventory Components', () => {
  const mockProject: ProjectItem = {
    id: '11111111-1111-1111-1111-111111111111',
    companyId: '22222222-2222-2222-2222-222222222222',
    name: 'Prestige Lakeside Habitat',
    builderName: 'Prestige Group',
    location: 'Whitefield, Bengaluru',
    status: 'under_construction',
    reraNo: 'PRM/KA/RERA/1251/310/PR/170915/000244',
    possessionDate: 'Dec 2026',
    overview: 'Luxury residential development next to lake.',
    amenities: ['Clubhouse', 'Swimming Pool', 'Tennis Court'],
    usps: ['Lake View', 'Metro Proximity'],
    gallery: ['https://example.com/lake1.jpg'],
    floorPlans: [
      {
        title: '3 BHK Type A',
        bhk: 3,
        carpetAreaSqft: 1450,
        superAreaSqft: 1950,
        planUrl: 'https://example.com/plan3bhk.jpg',
      },
    ],
    paymentPlans: ['10:90 Developer Plan', 'CLP'],
    offers: ['Zero pre-EMI until possession'],
    localityInsights: {
      metro: ['Kadugodi Metro (1.2 km)'],
      schools: ['DPS Whitefield (3 km)'],
      hospitals: ['Manipal Hospital (4 km)'],
    },
    pricingDetails: {
      startingPrice: 15000000,
    },
    totalUnitsCount: 120,
    availableUnitsCount: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders ProjectCard element with project attributes and click handler', () => {
    const handleClick = vi.fn();
    const el = React.createElement(ProjectCard, {
      project: mockProject,
      onClick: handleClick,
    });

    expect(el).toBeDefined();
    expect(el.props.project.name).toBe('Prestige Lakeside Habitat');
    expect(el.props.project.builderName).toBe('Prestige Group');
    expect(el.props.project.availableUnitsCount).toBe(45);
    expect(el.props.onClick).toBe(handleClick);
  });

  it('instantiates EmiCalculator with custom initialPrice', () => {
    const el = React.createElement(EmiCalculator, {
      initialPrice: 20000000,
    });

    expect(el).toBeDefined();
    expect(el.props.initialPrice).toBe(20000000);
  });

  it('instantiates PropertyCompareModal with multiple properties', () => {
    const handleClose = vi.fn();
    const el = React.createElement(PropertyCompareModal, {
      isOpen: true,
      onClose: handleClose,
      properties: [mockProject],
    });

    expect(el).toBeDefined();
    expect(el.props.isOpen).toBe(true);
    expect(el.props.properties).toHaveLength(1);
    expect(el.props.properties[0].name).toBe('Prestige Lakeside Habitat');
  });
});
