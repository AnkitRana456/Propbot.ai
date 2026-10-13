import { db } from '../../db/index.js';
import { projects, units, brochures } from '../../db/schema/index.js';
import { eq, and, sql, ilike, isNull, inArray } from 'drizzle-orm';
import type {
  PropertySearchInput,
  PropertyCardResponse,
  ProjectStatus,
} from '@propbot/shared';

export class PropertySearchService {
  /**
   * Structured property search with multi-parameter filtering and score ranking.
   */
  async searchProperties(
    companyId: string,
    filters: PropertySearchInput,
  ): Promise<PropertyCardResponse[]> {
    const limit = filters.limit || 5;

    // 1. Identify active projects for tenant
    const projectConditions = [
      eq(projects.companyId, companyId),
      isNull(projects.deletedAt),
    ];

    if (filters.status) {
      projectConditions.push(eq(projects.status, filters.status));
    }

    if (filters.locality) {
      projectConditions.push(ilike(projects.location, `%${filters.locality}%`));
    }

    const matchedProjects = await db
      .select()
      .from(projects)
      .where(and(...projectConditions));

    if (matchedProjects.length === 0) {
      return [];
    }

    const projectIds = matchedProjects.map(p => p.id);

    // 2. Fetch available units matching criteria
    const unitConditions = [
      eq(units.companyId, companyId),
      inArray(units.projectId, projectIds),
      eq(units.status, 'available'),
      isNull(units.deletedAt),
    ];

    const desiredBhks: number[] = filters.bhk
      ? Array.isArray(filters.bhk)
        ? filters.bhk
        : [filters.bhk]
      : [];

    if (desiredBhks.length > 0) {
      unitConditions.push(inArray(units.bhk, desiredBhks));
    }

    if (filters.budgetMax) {
      unitConditions.push(sql`${units.price} <= ${filters.budgetMax}`);
    }

    if (filters.budgetMin) {
      unitConditions.push(sql`${units.price} >= ${filters.budgetMin}`);
    }

    const matchingUnits = await db
      .select()
      .from(units)
      .where(and(...unitConditions));

    // Also fetch all available units for these projects for summary ranges
    const allAvailableUnits = await db
      .select({
        projectId: units.projectId,
        bhk: units.bhk,
        price: units.price,
        carpetAreaSqft: units.carpetAreaSqft,
      })
      .from(units)
      .where(
        and(
          eq(units.companyId, companyId),
          inArray(units.projectId, projectIds),
          eq(units.status, 'available'),
          isNull(units.deletedAt),
        ),
      );

    // Group units by project
    const projectUnitsMap = new Map<string, typeof allAvailableUnits>();
    for (const u of allAvailableUnits) {
      const list = projectUnitsMap.get(u.projectId) || [];
      list.push(u);
      projectUnitsMap.set(u.projectId, list);
    }

    // Projects that have matching units (if specific filters were provided)
    const matchingProjectIds = new Set<string>();
    if (desiredBhks.length > 0 || filters.budgetMax || filters.budgetMin) {
      matchingUnits.forEach(u => matchingProjectIds.add(u.projectId));
    } else {
      matchedProjects.forEach(p => matchingProjectIds.add(p.id));
    }

    // Fetch brochures for matching projects
    const projectBrochures = await db
      .select()
      .from(brochures)
      .where(
        and(
          eq(brochures.companyId, companyId),
          inArray(brochures.projectId, projectIds),
        ),
      );

    const brochureMap = new Map<string, string>();
    for (const b of projectBrochures) {
      brochureMap.set(b.projectId, b.fileUrl);
    }

    // 3. Assemble and rank PropertyCardResponse
    const cards: PropertyCardResponse[] = [];

    for (const proj of matchedProjects) {
      // Must have at least matching units or if no unit constraints were given, has any available units
      const projUnits = projectUnitsMap.get(proj.id) || [];
      if (projUnits.length === 0) continue; // Skip sold out projects

      const isStrictMatch = matchingProjectIds.has(proj.id);
      if (!isStrictMatch && (desiredBhks.length > 0 || filters.budgetMax)) {
        continue; // Project has no units meeting budget or bhk
      }

      // Calculate price and BHK ranges
      const prices = projUnits.map(u => Number(u.price)).sort((a, b) => a - b);
      const minPrice = prices[0];
      const maxPrice = prices[prices.length - 1];
      const bhkSet = Array.from(new Set(projUnits.map(u => u.bhk))).sort((a, b) => a - b);
      const areas = projUnits.map(u => Number(u.carpetAreaSqft)).sort((a, b) => a - b);

      const hasPrices = minPrice !== undefined && maxPrice !== undefined;
      const priceRange = hasPrices
        ? minPrice === maxPrice
          ? `₹${(minPrice! / 10000000).toFixed(2)} Cr`
          : `₹${(minPrice! / 10000000).toFixed(2)} Cr – ₹${(maxPrice! / 10000000).toFixed(2)} Cr`
        : 'Price on Request';

      const carpetAreaRange =
        areas.length > 0
          ? areas[0] === areas[areas.length - 1]
            ? `${areas[0]} sq.ft`
            : `${areas[0]} – ${areas[areas.length - 1]} sq.ft`
          : 'Specs on Request';

      // Scoring & match highlights
      const highlights: string[] = [];
      let matchScore = 70;

      if (filters.locality && proj.location.toLowerCase().includes(filters.locality.toLowerCase())) {
        highlights.push(`Prime ${proj.location} location`);
        matchScore += 10;
      }

      if (desiredBhks.some(b => bhkSet.includes(b))) {
        highlights.push(`Available in ${desiredBhks.join(', ')}BHK`);
        matchScore += 10;
      }

      if (filters.budgetMax && minPrice !== undefined && minPrice <= filters.budgetMax) {
        highlights.push(`Starting well within budget`);
        matchScore += 10;
      }

      const gallery = (proj.gallery as string[]) || [];
      const heroImage = gallery[0] || null;

      cards.push({
        projectId: proj.id,
        name: proj.name,
        builderName: proj.builderName,
        location: proj.location,
        latitude: proj.latitude ? Number(proj.latitude) : null,
        longitude: proj.longitude ? Number(proj.longitude) : null,
        status: proj.status as ProjectStatus,
        possessionDate: proj.possessionDate,
        startingPrice: minPrice,
        priceRange,
        bhkOptions: bhkSet,
        carpetAreaRange,
        heroImage,
        gallery,
        amenities: (proj.amenities as string[]) || [],
        usps: (proj.usps as string[]) || [],
        reraNo: proj.reraNo,
        availableUnitsCount: projUnits.length,
        brochureUrl: brochureMap.get(proj.id) || null,
        videoTourUrl: proj.videoTourUrl,
        matchScore: Math.min(100, matchScore),
        matchHighlights: highlights,
      });
    }

    // Sort by matchScore desc, then startingPrice asc
    cards.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0) || (a.startingPrice || 0) - (b.startingPrice || 0));

    return cards.slice(0, limit);
  }
}

export const propertySearchService = new PropertySearchService();
