import { describe, it, expect } from 'vitest';
import { modelRouter } from '../../src/modules/ai/router.js';

describe('Security: PII Masking in LLM Traces (Phase 14.1)', () => {
  it('masks raw email addresses from user prompts before trace logging', () => {
    const raw = 'Please send the floor plan to rajesh.kumar+invest@example.co.in right away.';
    const masked = modelRouter.maskPii(raw);
    expect(masked).not.toContain('rajesh.kumar+invest@example.co.in');
    expect(masked).toContain('[EMAIL]');
    expect(masked).toBe('Please send the floor plan to [EMAIL] right away.');
  });

  it('masks Indian and international telephone numbers from user queries', () => {
    const rawWithPhone = 'My contact number is +91-98765-43210. You can also reach me at 9876543210.';
    const masked = modelRouter.maskPii(rawWithPhone);
    expect(masked).not.toContain('9876543210');
    expect(masked).not.toContain('+91');
    expect(masked).toContain('[PHONE]');
  });

  it('masks credit card and bank account numbers if mentioned', () => {
    const rawWithCard = 'Can I pay the token with card 4111 2222 3333 4444?';
    const masked = modelRouter.maskPii(rawWithCard);
    expect(masked).not.toContain('4111 2222 3333 4444');
    expect(masked).toContain('[CARD]');
  });

  it('preserves real estate keywords and numerical parameters without corruption', () => {
    const realEstateQuery = 'Looking for 3BHK villa in Whitefield with budget 2.5 Cr and 2400 sq ft.';
    const masked = modelRouter.maskPii(realEstateQuery);
    expect(masked).toBe(realEstateQuery);
  });
});
