import { db } from '../../db/index.js';
import { units } from '../../db/schema/index.js';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { BuyerDna, ProjectItem, UnitItem, UnitStatus } from '@propbot/shared';
import { inventoryService } from './inventory.service.js';

export interface MatchedProjectRecommendation {
  project: ProjectItem;
  recommendedUnit: UnitItem | null;
  matchScore: number;
  matchHighlights: string[];
}

export class ShortlistMatchingService {
  /**
   * Evaluates available projects against a lead's Buyer DNA
   * and returns the top 3-5 recommended properties with match scores and highlights.
   */
  async matchProjectsForLead(
    companyId: string,
    buyerDna: Partial<BuyerDna>,
  ): Promise<MatchedProjectRecommendation[]> {
    // 1. Fetch all active projects for the company
    const projectsList = await inventoryService.listProjects(companyId, { limit: 100 });
    const activeProjects = projectsList.items.filter(p => (p.availableUnitsCount || 0) > 0);

    if (activeProjects.length === 0) {
      return [];
    }

    const projectIds = activeProjects.map(p => p.id);

    // 2. Fetch all available units for these projects
    const availableUnits = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.companyId, companyId),
          inArray(units.projectId, projectIds),
          eq(units.status, 'available'),
          isNull(units.deletedAt),
        ),
      );

    const unitsByProject = new Map<string, typeof availableUnits>();
    for (const u of availableUnits) {
      const list = unitsByProject.get(u.projectId) || [];
      list.push(u);
      unitsByProject.set(u.projectId, list);
    }

    const recommendations: MatchedProjectRecommendation[] = [];

    const budgetMin = buyerDna.budgetMin || 0;
    const budgetMax = buyerDna.budgetMax || Infinity;
    const desiredBhks = (buyerDna.bhk || []).map(b => parseInt(String(b).replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const desiredLocalities = (buyerDna.localities || []).map(l => l.toLowerCase().trim());
    const timeline = buyerDna.timeline;

    for (const project of activeProjects) {
      const projUnits = unitsByProject.get(project.id) || [];
      if (projUnits.length === 0) continue;

      let score = 0;
      const highlights: string[] = [];

      // A. Budget Fit (40 points max)
      const prices = projUnits.map(u => Number(u.price)).sort((a, b) => a - b);
      const minPrice = prices[0];
      const maxPrice = prices[prices.length - 1];

      if (budgetMax !== Infinity && budgetMax > 0 && minPrice !== undefined && maxPrice !== undefined) {
        if (minPrice <= budgetMax && maxPrice >= budgetMin) {
          // Complete price overlap
          score += 40;
          highlights.push(`Units starting at ₹${(minPrice / 10000000).toFixed(2)} Cr fit your budget`);
        } else if (minPrice <= budgetMax * 1.1) {
          // Within 10% tolerance
          score += 28;
          highlights.push(`Close to your budget at ₹${(minPrice / 10000000).toFixed(2)} Cr`);
        } else {
          score += 10;
        }
      } else {
        // Budget not specified, give moderate base
        score += 25;
      }

      // B. BHK Match (30 points max)
      const projBhks = Array.from(new Set(projUnits.map(u => u.bhk)));
      if (desiredBhks.length > 0) {
        const hasExactBhk = desiredBhks.some(b => projBhks.includes(b));
        if (hasExactBhk) {
          score += 30;
          const matched = desiredBhks.filter(b => projBhks.includes(b));
          highlights.push(`Offers verified ${matched.join(', ')}BHK layouts`);
        } else {
          score += 10;
        }
      } else {
        score += 20;
      }

      // C. Locality Match (20 points max)
      if (desiredLocalities.length > 0) {
        const projLoc = project.location.toLowerCase();
        const matchesLocality = desiredLocalities.some(loc => projLoc.includes(loc) || loc.includes(projLoc));
        if (matchesLocality) {
          score += 20;
          highlights.push(`Prime location in ${project.location}`);
        } else {
          score += 5;
        }
      } else {
        score += 15;
      }

      // D. Timeline Match (10 points max)
      if (timeline === 'immediate' && project.status === 'ready_to_move') {
        score += 10;
        highlights.push(`Ready to move in immediately`);
      } else if (timeline === 'under_construction' && project.status === 'under_construction') {
        score += 10;
        highlights.push(`Under-construction with flexible possession (${project.possessionDate || '2026-2027'})`);
      } else {
        score += 5;
      }

      // Select best matching unit for recommendation
      let bestUnit = projUnits[0];
      if (desiredBhks.length > 0) {
        const bhkUnits = projUnits.filter(u => desiredBhks.includes(u.bhk));
        if (bhkUnits.length > 0) {
          bestUnit = bhkUnits[0];
        }
      }

      const formattedUnit: UnitItem | null = bestUnit
        ? {
            id: bestUnit.id,
            companyId: bestUnit.companyId,
            projectId: bestUnit.projectId,
            projectName: project.name,
            tower: bestUnit.tower,
            floor: bestUnit.floor,
            unitNumber: bestUnit.unitNumber,
            bhk: bestUnit.bhk,
            carpetAreaSqft: Number(bestUnit.carpetAreaSqft),
            superAreaSqft: bestUnit.superAreaSqft ? Number(bestUnit.superAreaSqft) : null,
            price: Number(bestUnit.price),
            status: bestUnit.status as UnitStatus,
            facing: bestUnit.facing,
            furnishing: bestUnit.furnishing,
            createdAt: bestUnit.createdAt.toISOString(),
            updatedAt: bestUnit.updatedAt.toISOString(),
          }
        : null;

      recommendations.push({
        project,
        recommendedUnit: formattedUnit,
        matchScore: Math.min(100, Math.round(score)),
        matchHighlights: highlights,
      });
    }

    // Sort by highest matchScore descending, then lowest startingPrice
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    // Return top 3-5
    return recommendations.slice(0, 5);
  }
}

export const shortlistMatchingService = new ShortlistMatchingService();
