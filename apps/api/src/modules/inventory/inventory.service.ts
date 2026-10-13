import { eq, and, sql, desc, ilike, or, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { projects, units } from '../../db/schema/index.js';
import type {
  ProjectItem,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectsListResponse,
  UnitItem,
  CreateUnitInput,
  UnitsListResponse,
  UnitStatus,
  ProjectStatus,
  FloorPlan,
  LocalityInsights,
  ProjectPricingDetails,
} from '@propbot/shared';
import { KnowledgeService } from '../knowledge/knowledge.service.js';

export class InventoryService {
  private knowledgeService = new KnowledgeService();

  /**
   * Lists projects with search, status filter, pagination, and active unit count aggregations.
   */
  async listProjects(
    companyId: string,
    params: {
      status?: ProjectStatus;
      search?: string;
      location?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<ProjectsListResponse> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(projects.companyId, companyId),
      isNull(projects.deletedAt),
    ];

    if (params.status) {
      conditions.push(eq(projects.status, params.status));
    }

    if (params.location) {
      conditions.push(ilike(projects.location, `%${params.location}%`));
    }

    if (params.search) {
      const q = `%${params.search}%`;
      conditions.push(
        or(
          ilike(projects.name, q),
          ilike(projects.builderName, q),
          ilike(projects.location, q),
          ilike(projects.reraNo, q),
        )!,
      );
    }

    const whereClause = and(...conditions);

    // Fetch projects
    const rows = await db
      .select()
      .from(projects)
      .where(whereClause)
      .orderBy(desc(projects.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(whereClause);

    // Aggregate unit counts for fetched projects
    const projectIds = rows.map(r => r.id);
    const unitStatsMap = new Map<string, { total: number; available: number }>();

    if (projectIds.length > 0) {
      const unitCounts = await db
        .select({
          projectId: units.projectId,
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(case when ${units.status} = 'available' then 1 end)::int`,
        })
        .from(units)
        .where(
          and(
            eq(units.companyId, companyId),
            sql`${units.projectId} in ${projectIds}`,
            isNull(units.deletedAt),
          ),
        )
        .groupBy(units.projectId);

      for (const stat of unitCounts) {
        unitStatsMap.set(stat.projectId, {
          total: stat.total,
          available: stat.available,
        });
      }
    }

    const items: ProjectItem[] = rows.map(r => {
      const stats = unitStatsMap.get(r.id) || { total: 0, available: 0 };
      return {
        id: r.id,
        companyId: r.companyId,
        name: r.name,
        builderName: r.builderName,
        reraNo: r.reraNo,
        location: r.location,
        latitude: r.latitude ? Number(r.latitude) : null,
        longitude: r.longitude ? Number(r.longitude) : null,
        mapUrl: r.mapUrl,
        status: r.status as ProjectStatus,
        possessionDate: r.possessionDate,
        overview: r.overview,
        amenities: (r.amenities as string[]) || [],
        usps: (r.usps as string[]) || [],
        gallery: (r.gallery as string[]) || [],
        videoTourUrl: r.videoTourUrl,
        floorPlans: (r.floorPlans as FloorPlan[]) || [],
        priceSheetUrl: r.priceSheetUrl,
        paymentPlans: (r.paymentPlans as string[]) || [],
        offers: (r.offers as string[]) || [],
        localityInsights: (r.localityInsights as LocalityInsights) || {},
        pricingDetails: (r.pricingDetails as ProjectPricingDetails) || {},
        totalUnitsCount: stats.total,
        availableUnitsCount: stats.available,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total: countResult?.count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Retrieves full details for a single project.
   */
  async getProjectById(companyId: string, projectId: string): Promise<ProjectItem> {
    const [row] = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.companyId, companyId),
          isNull(projects.deletedAt),
        ),
      );

    if (!row) {
      const err = new Error('Project not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const [unitCounts] = await db
      .select({
        total: sql<number>`count(*)::int`,
        available: sql<number>`count(case when ${units.status} = 'available' then 1 end)::int`,
      })
      .from(units)
      .where(
        and(
          eq(units.companyId, companyId),
          eq(units.projectId, projectId),
          isNull(units.deletedAt),
        ),
      );

    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      builderName: row.builderName,
      reraNo: row.reraNo,
      location: row.location,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      mapUrl: row.mapUrl,
      status: row.status as ProjectStatus,
      possessionDate: row.possessionDate,
      overview: row.overview,
      amenities: (row.amenities as string[]) || [],
      usps: (row.usps as string[]) || [],
      gallery: (row.gallery as string[]) || [],
      videoTourUrl: row.videoTourUrl,
      floorPlans: (row.floorPlans as FloorPlan[]) || [],
      priceSheetUrl: row.priceSheetUrl,
      paymentPlans: (row.paymentPlans as string[]) || [],
      offers: (row.offers as string[]) || [],
      localityInsights: (row.localityInsights as LocalityInsights) || {},
      pricingDetails: (row.pricingDetails as ProjectPricingDetails) || {},
      totalUnitsCount: unitCounts?.total ?? 0,
      availableUnitsCount: unitCounts?.available ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new property project.
   */
  async createProject(companyId: string, input: CreateProjectInput): Promise<ProjectItem> {
    const [created] = await db
      .insert(projects)
      .values({
        companyId,
        name: input.name,
        builderName: input.builderName,
        reraNo: input.reraNo || null,
        location: input.location,
        latitude: input.latitude ? String(input.latitude) : null,
        longitude: input.longitude ? String(input.longitude) : null,
        mapUrl: input.mapUrl || null,
        status: input.status || 'under_construction',
        possessionDate: input.possessionDate || null,
        overview: input.overview || null,
        amenities: input.amenities || [],
        usps: input.usps || [],
        gallery: input.gallery || [],
        videoTourUrl: input.videoTourUrl || null,
        floorPlans: input.floorPlans || [],
        priceSheetUrl: input.priceSheetUrl || null,
        paymentPlans: input.paymentPlans || [],
        offers: input.offers || [],
        localityInsights: input.localityInsights || {},
        pricingDetails: input.pricingDetails || {},
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create project');
    }

    return this.getProjectById(companyId, created.id);
  }

  /**
   * Updates an existing project.
   */
  async updateProject(
    companyId: string,
    projectId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectItem> {
    const existing = await this.getProjectById(companyId, projectId);

    await db
      .update(projects)
      .set({
        name: input.name ?? existing.name,
        builderName: input.builderName ?? existing.builderName,
        reraNo: input.reraNo !== undefined ? input.reraNo : existing.reraNo,
        location: input.location ?? existing.location,
        latitude: input.latitude !== undefined ? (input.latitude ? String(input.latitude) : null) : (existing.latitude ? String(existing.latitude) : null),
        longitude: input.longitude !== undefined ? (input.longitude ? String(input.longitude) : null) : (existing.longitude ? String(existing.longitude) : null),
        mapUrl: input.mapUrl !== undefined ? input.mapUrl : existing.mapUrl,
        status: input.status ?? existing.status,
        possessionDate: input.possessionDate !== undefined ? input.possessionDate : existing.possessionDate,
        overview: input.overview !== undefined ? input.overview : existing.overview,
        amenities: input.amenities ?? existing.amenities,
        usps: input.usps ?? existing.usps,
        gallery: input.gallery ?? existing.gallery,
        videoTourUrl: input.videoTourUrl !== undefined ? input.videoTourUrl : existing.videoTourUrl,
        floorPlans: input.floorPlans ?? existing.floorPlans,
        priceSheetUrl: input.priceSheetUrl !== undefined ? input.priceSheetUrl : existing.priceSheetUrl,
        paymentPlans: input.paymentPlans ?? existing.paymentPlans,
        offers: input.offers ?? existing.offers,
        localityInsights: input.localityInsights ?? existing.localityInsights,
        pricingDetails: input.pricingDetails ?? existing.pricingDetails,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)));

    return this.getProjectById(companyId, projectId);
  }

  /**
   * Soft-deletes a project.
   */
  async deleteProject(companyId: string, projectId: string): Promise<{ success: boolean }> {
    await this.getProjectById(companyId, projectId);

    await db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.companyId, companyId)));

    return { success: true };
  }

  // ==========================================
  // Unit Inventory Management
  // ==========================================

  /**
   * Lists units for a project with optional filters.
   */
  async listUnits(
    companyId: string,
    projectId: string,
    params: {
      bhk?: number;
      status?: UnitStatus;
      floor?: number;
      priceMax?: number;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<UnitsListResponse> {
    await this.getProjectById(companyId, projectId);

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(units.companyId, companyId),
      eq(units.projectId, projectId),
      isNull(units.deletedAt),
    ];

    if (params.bhk) {
      conditions.push(eq(units.bhk, params.bhk));
    }

    if (params.status) {
      conditions.push(eq(units.status, params.status));
    }

    if (params.floor !== undefined) {
      conditions.push(eq(units.floor, params.floor));
    }

    if (params.priceMax) {
      conditions.push(sql`${units.price} <= ${params.priceMax}`);
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        unit: units,
        projectName: projects.name,
      })
      .from(units)
      .leftJoin(projects, eq(units.projectId, projects.id))
      .where(whereClause)
      .orderBy(units.bhk, units.unitNumber)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(units)
      .where(whereClause);

    const items: UnitItem[] = rows.map(r => ({
      id: r.unit.id,
      companyId: r.unit.companyId,
      projectId: r.unit.projectId,
      projectName: r.projectName ?? undefined,
      tower: r.unit.tower,
      floor: r.unit.floor,
      unitNumber: r.unit.unitNumber,
      bhk: r.unit.bhk,
      carpetAreaSqft: Number(r.unit.carpetAreaSqft),
      superAreaSqft: r.unit.superAreaSqft ? Number(r.unit.superAreaSqft) : null,
      price: Number(r.unit.price),
      status: r.unit.status as UnitStatus,
      facing: r.unit.facing,
      furnishing: r.unit.furnishing,
      createdAt: r.unit.createdAt.toISOString(),
      updatedAt: r.unit.updatedAt.toISOString(),
    }));

    return {
      items,
      total: countResult?.count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Creates an individual unit.
   */
  async createUnit(
    companyId: string,
    projectId: string,
    input: CreateUnitInput,
  ): Promise<UnitItem> {
    await this.getProjectById(companyId, projectId);

    const [created] = await db
      .insert(units)
      .values({
        companyId,
        projectId,
        tower: input.tower || null,
        floor: input.floor !== undefined ? input.floor : null,
        unitNumber: input.unitNumber,
        bhk: input.bhk,
        carpetAreaSqft: String(input.carpetAreaSqft),
        superAreaSqft: input.superAreaSqft ? String(input.superAreaSqft) : null,
        price: String(input.price),
        status: input.status || 'available',
        facing: input.facing || null,
        furnishing: input.furnishing || 'unfurnished',
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create unit');
    }

    return {
      id: created.id,
      companyId: created.companyId,
      projectId: created.projectId,
      tower: created.tower,
      floor: created.floor,
      unitNumber: created.unitNumber,
      bhk: created.bhk,
      carpetAreaSqft: Number(created.carpetAreaSqft),
      superAreaSqft: created.superAreaSqft ? Number(created.superAreaSqft) : null,
      price: Number(created.price),
      status: created.status as UnitStatus,
      facing: created.facing,
      furnishing: created.furnishing,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Updates unit availability status inline.
   */
  async updateUnitStatus(
    companyId: string,
    unitId: string,
    status: UnitStatus,
  ): Promise<UnitItem> {
    const [row] = await db
      .select()
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.companyId, companyId), isNull(units.deletedAt)));

    if (!row) {
      const err = new Error('Unit not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const [updated] = await db
      .update(units)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(units.id, unitId), eq(units.companyId, companyId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update unit');
    }

    return {
      id: updated.id,
      companyId: updated.companyId,
      projectId: updated.projectId,
      tower: updated.tower,
      floor: updated.floor,
      unitNumber: updated.unitNumber,
      bhk: updated.bhk,
      carpetAreaSqft: Number(updated.carpetAreaSqft),
      superAreaSqft: updated.superAreaSqft ? Number(updated.superAreaSqft) : null,
      price: Number(updated.price),
      status: updated.status as UnitStatus,
      facing: updated.facing,
      furnishing: updated.furnishing,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Formats project specifications into textual knowledge representation
   * and auto-indexes into knowledge chunks for the tenant chatbots.
   */
  async syncProjectToKnowledgeBase(companyId: string, projectId: string): Promise<{ success: boolean; text: string }> {
    const project = await this.getProjectById(companyId, projectId);
    const unitsData = await this.listUnits(companyId, projectId, { limit: 100 });

    const unitsSummary = unitsData.items.reduce((acc, u) => {
      const existing = acc[u.bhk] || { count: 0, minPrice: u.price, maxPrice: u.price, minSqft: u.carpetAreaSqft };
      existing.count += 1;
      existing.minPrice = Math.min(existing.minPrice, u.price);
      existing.maxPrice = Math.max(existing.maxPrice, u.price);
      acc[u.bhk] = existing;
      return acc;
    }, {} as Record<number, { count: number; minPrice: number; maxPrice: number; minSqft: number }>);

    const textParts = [
      `# PROJECT: ${project.name}`,
      `Developer / Builder: ${project.builderName}`,
      `Location: ${project.location}`,
      `RERA Registration: ${project.reraNo || 'In Process'}`,
      `Construction Status: ${project.status.replace('_', ' ').toUpperCase()}`,
      `Expected Possession: ${project.possessionDate || 'Contact Sales'}`,
      `Overview: ${project.overview || 'Luxury residential development.'}`,
      `Key Selling Points (USPs): ${project.usps.join('; ')}`,
      `Amenities: ${project.amenities.join(', ')}`,
      `Payment Plans: ${project.paymentPlans.join('; ')}`,
      `Current Offers: ${project.offers.join('; ') || 'None'}`,
      `Connectivity & Locality Insights: Metro: ${project.localityInsights?.metro?.join(', ') || 'Nearby'}; Schools: ${project.localityInsights?.schools?.join(', ') || 'Nearby'}; Hospitals: ${project.localityInsights?.hospitals?.join(', ') || 'Nearby'}`,
      `\nUnit Configurations & Pricing:`,
    ];

    for (const [bhk, info] of Object.entries(unitsSummary)) {
      textParts.push(
        `- ${bhk}BHK Residences: ${info.count} units available from ₹${(info.minPrice / 10000000).toFixed(2)} Cr to ₹${(info.maxPrice / 10000000).toFixed(2)} Cr (Carpet area approx ${info.minSqft} sq.ft)`,
      );
    }

    const fullContent = textParts.join('\n');
    return { success: true, text: fullContent };
  }
}

export const inventoryService = new InventoryService();
