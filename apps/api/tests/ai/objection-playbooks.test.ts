import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testDb, cleanupTestDatabase } from '../helpers/test-db.js';
import { companies } from '../../src/db/schema/index.js';
import { playbooksService } from '../../src/modules/ai/playbooks.service.js';

describe('Agency Objection-Handling Playbooks & RLS Isolation', () => {
  const companyAId = '99999999-9999-9999-9999-999999999914';
  const companyBId = '99999999-9999-9999-9999-999999999915';

  beforeAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);

    await testDb
      .insert(companies)
      .values([
        {
          id: companyAId,
          name: 'Playbooks Realty A',
          slug: 'playbooks-realty-a',
          plan: 'growth',
          status: 'active',
        },
        {
          id: companyBId,
          name: 'Playbooks Realty B',
          slug: 'playbooks-realty-b',
          plan: 'growth',
          status: 'active',
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await cleanupTestDatabase([companyAId, companyBId]);
  });

  it('creates, updates, and retrieves objection playbooks for an agency', async () => {
    const created = await playbooksService.createPlaybook(companyAId, {
      category: 'price_too_high',
      title: 'Price is too high compared to local market',
      triggerKeywords: ['expensive', 'costly', 'discount', 'high price'],
      rebuttalText:
        'Our residences feature superior 82% carpet area efficiency, imported Kohler fittings, and 2 private car parks included in the all-inclusive pricing.',
      suggestedAction: 'Offer flexible 20:80 milestone construction payment schedule',
      isActive: true,
    });

    expect(created.id).toBeDefined();
    expect(created.category).toBe('price_too_high');
    expect(created.triggerKeywords).toContain('expensive');

    // Retrieve list
    const list = await playbooksService.listPlaybooks(companyAId);
    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(list.playbooks.some(p => p.id === created.id)).toBe(true);

    // Update
    const updated = await playbooksService.updatePlaybook(companyAId, created.id, {
      rebuttalText: 'Updated verified rebuttal with 3-year maintenance waiver.',
    });
    expect(updated.rebuttalText).toBe('Updated verified rebuttal with 3-year maintenance waiver.');
  });

  it('matches visitor objection trigger keywords to active playbooks', async () => {
    const matched = await playbooksService.findMatchingPlaybook(
      companyAId,
      'Why is this property so expensive compared to others?',
    );

    expect(matched).toBeDefined();
    expect(matched?.category).toBe('price_too_high');
    expect(matched?.rebuttalText).toContain('maintenance waiver');

    // Query with unrelated text returns null
    const unmatched = await playbooksService.findMatchingPlaybook(
      companyAId,
      'What are the gym timings on Sunday morning?',
    );
    expect(unmatched).toBeNull();
  });

  it('enforces strict multi-tenant isolation across companies', async () => {
    // Company B should not see Company A's playbooks
    const listB = await playbooksService.listPlaybooks(companyBId);
    expect(listB.total).toBe(0);

    // Matching in Company B returns null
    const matchedInB = await playbooksService.findMatchingPlaybook(
      companyBId,
      'Why is this property so expensive?',
    );
    expect(matchedInB).toBeNull();

    // Company B cannot delete Company A's playbook
    const listA = await playbooksService.listPlaybooks(companyAId);
    const playbookA = listA.playbooks[0]!;

    await expect(
      playbooksService.deletePlaybook(companyBId, playbookA.id),
    ).rejects.toThrow('Playbook not found');

    // Company A can delete its own playbook
    await playbooksService.deletePlaybook(companyAId, playbookA.id);
    const postDeleteListA = await playbooksService.listPlaybooks(companyAId);
    expect(postDeleteListA.playbooks.some(p => p.id === playbookA.id)).toBe(false);
  });
});
