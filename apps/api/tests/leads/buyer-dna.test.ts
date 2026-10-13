import { describe, it, expect } from 'vitest';
import { buyerDnaService } from '../../src/modules/leads/buyer-dna.service.js';

describe('BuyerDnaService', () => {
  it('extracts budget in Crores and Lakhs', () => {
    const text1 = 'We have a budget of 2.5 to 3.5 Cr for our next home';
    const result1 = buyerDnaService.extractWithRules(text1);

    expect(result1.budgetMin).toBe(25000000);
    expect(result1.budgetMax).toBe(35000000);

    const text2 = 'Looking for a flat under 80 Lakhs in Whitefield';
    const result2 = buyerDnaService.extractWithRules(text2);
    expect(result2.budgetMax).toBe(8000000);
  });

  it('extracts BHK configurations, property type, purpose, and timeline', () => {
    const message =
      'Looking for a 3BHK or 4BHK luxury villa in Sarjapur for investment. Need ready to move possession with bank loan pre-approved.';
    const result = buyerDnaService.extractWithRules(message);

    expect(result.bhk).toContain('3BHK');
    expect(result.bhk).toContain('4BHK');
    expect(result.propertyType).toBe('villa');
    expect(result.purpose).toBe('investment');
    expect(result.timeline).toBe('immediate');
    expect(result.financing).toBe('pre_approved');
    expect(result.localities).toContain('Sarjapur');
  });

  it('extracts must-haves, deal-breakers, objections, and competitors', () => {
    const message =
      'Must have private garden, east facing, and servant room. No high rise above 10th floor. Price is a bit expensive compared to Sobha Neopolis.';
    const result = buyerDnaService.extractWithRules(message);

    expect(result.mustHaves).toContain('Private Garden');
    expect(result.mustHaves).toContain('East Facing');
    expect(result.mustHaves).toContain('Servant Room');
    expect(result.dealBreakers).toContain('High Rise Restrictions');
    expect(result.objections).toContain('Pricing exceeds initial expectations');
    expect(result.competitorsMentioned).toContain('Sobha');
  });

  it('merges new facts without losing previous context', () => {
    const initial = buyerDnaService.getDefaultDna();
    initial.bhk = ['3BHK'];
    initial.localities = ['Whitefield'];

    const updates = {
      propertyType: 'villa',
      localities: ['Sarjapur'],
    };

    const merged = buyerDnaService.mergeDna(initial, updates);

    expect(merged.bhk).toEqual(['3BHK']);
    expect(merged.propertyType).toBe('villa');
    // Localities merged
    expect(merged.localities).toContain('Whitefield');
    expect(merged.localities).toContain('Sarjapur');
  });

  it('handles user corrections by overwriting previously inferred values', () => {
    const initial = buyerDnaService.getDefaultDna();
    initial.bhk = ['2BHK'];
    initial.budgetMax = 10000000;

    // User explicitly corrects: "Actually, I need 4BHK with 2.5 Cr budget"
    const corrections = {
      bhk: ['4BHK'],
      budgetMax: 25000000,
    };
    const explicitFields = ['bhk', 'budgetMax'];

    const updated = buyerDnaService.mergeDna(initial, corrections, explicitFields);

    expect(updated.bhk).toEqual(['4BHK']);
    expect(updated.budgetMax).toBe(25000000);
    expect(updated.confidence['bhk']).toBe(1.0);
    expect(updated.explicitFields).toContain('bhk');
  });
});
