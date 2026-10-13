import { db } from '../../db/index.js';
import {
  shortlistRooms,
  shortlistItems,
  projects,
  units,
  leads,
  contacts,
  companies,
  leadActivities,
  domainEvents,
} from '../../db/schema/index.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';
import type {
  CreateShortlistRoomInput,
  ShortlistRoomResponse,
  ShortlistRoomPublicResponse,
  ShortlistTelemetryInput,
  ShortlistStatus,
  BuyerDna,
  UnitStatus,
} from '@propbot/shared';
import { shortlistMatchingService } from './shortlist-matching.service.js';
import { inventoryService } from './inventory.service.js';

export class ShortlistRoomService {
  /**
   * Generates a personalized Smart Shortlist Room for a lead.
   */
  async createShortlistRoom(
    companyId: string,
    input: CreateShortlistRoomInput,
  ): Promise<ShortlistRoomResponse> {
    // 1. Fetch lead
    const [lead] = await db
      .select({
        lead: leads,
        contact: contacts,
      })
      .from(leads)
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(and(eq(leads.id, input.leadId), eq(leads.companyId, companyId)));

    if (!lead) {
      const err = new Error('Lead not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const buyerDna = (lead.lead.buyerDna as Partial<BuyerDna>) || {};

    // 2. Determine matched properties
    let matchedItems: Array<{
      projectId: string;
      unitId?: string | null;
      matchScore: number;
      matchHighlights: string[];
    }> = [];

    if (input.projectIds && input.projectIds.length > 0) {
      // Agent manually selected specific projects
      for (let i = 0; i < input.projectIds.length; i++) {
        const pid = input.projectIds[i];
        if (pid) {
          matchedItems.push({
            projectId: pid,
            unitId: null,
            matchScore: 100 - i * 5,
            matchHighlights: ['Hand-curated by your dedicated property specialist'],
          });
        }
      }
    } else {
      // Auto-match via Buyer DNA matching engine
      const recs = await shortlistMatchingService.matchProjectsForLead(companyId, buyerDna);
      if (recs.length === 0) {
        // Fallback to top available projects
        const fallback = await inventoryService.listProjects(companyId, { limit: 3 });
        matchedItems = fallback.items.map((p, idx) => ({
          projectId: p.id,
          unitId: null,
          matchScore: 90 - idx * 5,
          matchHighlights: ['Top recommended residential project in portfolio'],
        }));
      } else {
        matchedItems = recs.map(r => ({
          projectId: r.project.id,
          unitId: r.recommendedUnit?.id || null,
          matchScore: r.matchScore,
          matchHighlights: r.matchHighlights,
        }));
      }
    }

    // 3. Generate token & expiration
    const token = crypto.randomBytes(24).toString('base64url');
    const expiresInDays = input.expiresInDays || 14;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const buyerName = lead.contact?.firstName ? `${lead.contact.firstName} ${lead.contact.lastName || ''}`.trim() : 'Valued Buyer';
    const title = input.title || `Curated Property Shortlist for ${buyerName}`;

    // 4. Save Room & Items in transaction
    const [createdRoom] = await db.transaction(async tx => {
      const [room] = await tx
        .insert(shortlistRooms)
        .values({
          companyId,
          leadId: input.leadId,
          token,
          title,
          matchedPreferences: buyerDna,
          expiresAt,
          status: 'active',
        })
        .returning();

      if (!room) throw new Error('Failed to create shortlist room');

      for (let idx = 0; idx < matchedItems.length; idx++) {
        const item = matchedItems[idx];
        if (item) {
          await tx.insert(shortlistItems).values({
            shortlistId: room.id,
            projectId: item.projectId,
            unitId: item.unitId || null,
            orderIndex: idx,
            matchScore: item.matchScore,
            matchHighlights: item.matchHighlights,
          });
        }
      }

      return [room];
    });

    if (!createdRoom) throw new Error('Failed to create shortlist room');
    return this.getShortlistRoomById(companyId, createdRoom.id);
  }

  /**
   * Retrieves room by ID for internal agent CRM view.
   */
  async getShortlistRoomById(companyId: string, roomId: string): Promise<ShortlistRoomResponse> {
    const [room] = await db
      .select()
      .from(shortlistRooms)
      .where(and(eq(shortlistRooms.id, roomId), eq(shortlistRooms.companyId, companyId)));

    if (!room) {
      const err = new Error('Shortlist room not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const items = await db
      .select({
        item: shortlistItems,
        project: projects,
        unit: units,
      })
      .from(shortlistItems)
      .leftJoin(projects, eq(shortlistItems.projectId, projects.id))
      .leftJoin(units, eq(shortlistItems.unitId, units.id))
      .where(eq(shortlistItems.shortlistId, room.id))
      .orderBy(shortlistItems.orderIndex);

    const formattedItems = await Promise.all(
      items.map(async r => {
        const projItem = await inventoryService.getProjectById(companyId, r.item.projectId);
        return {
          id: r.item.id,
          projectId: r.item.projectId,
          unitId: r.item.unitId,
          orderIndex: r.item.orderIndex,
          matchScore: r.item.matchScore,
          matchHighlights: (r.item.matchHighlights as string[]) || [],
          project: projItem,
          recommendedUnit: r.unit
            ? {
                id: r.unit.id,
                companyId: r.unit.companyId,
                projectId: r.unit.projectId,
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
              }
            : null,
        };
      }),
    );

    const baseUrl = process.env.WEB_URL || 'http://localhost:5173';

    return {
      id: room.id,
      companyId: room.companyId,
      leadId: room.leadId,
      token: room.token,
      title: room.title,
      matchedPreferences: (room.matchedPreferences as Record<string, unknown>) || {},
      expiresAt: room.expiresAt.toISOString(),
      viewsCount: room.viewsCount,
      lastViewedAt: room.lastViewedAt ? room.lastViewedAt.toISOString() : null,
      totalTimeSpentSeconds: room.totalTimeSpentSeconds,
      favoriteProjectId: room.favoriteProjectId,
      status: room.status as ShortlistStatus,
      items: formattedItems,
      shareableUrl: `${baseUrl}/room/${room.token}`,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    };
  }

  /**
   * Lists all shortlist rooms for a specific lead.
   */
  async listRoomsForLead(companyId: string, leadId: string): Promise<ShortlistRoomResponse[]> {
    const rows = await db
      .select({ id: shortlistRooms.id })
      .from(shortlistRooms)
      .where(and(eq(shortlistRooms.leadId, leadId), eq(shortlistRooms.companyId, companyId)))
      .orderBy(desc(shortlistRooms.createdAt));

    return Promise.all(rows.map(r => this.getShortlistRoomById(companyId, r.id)));
  }

  /**
   * Public standalone endpoint: loads Shortlist Room by secure token.
   */
  async getPublicRoomByToken(token: string): Promise<ShortlistRoomPublicResponse> {
    const [room] = await db
      .select({
        room: shortlistRooms,
        companyName: companies.name,
        contactFirstName: contacts.firstName,
      })
      .from(shortlistRooms)
      .leftJoin(companies, eq(shortlistRooms.companyId, companies.id))
      .leftJoin(leads, eq(shortlistRooms.leadId, leads.id))
      .leftJoin(contacts, eq(leads.contactId, contacts.id))
      .where(eq(shortlistRooms.token, token));

    if (!room) {
      const err = new Error('Shortlist room not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    const isExpired = new Date() > room.room.expiresAt;

    // Load items and projects
    const rawItems = await db
      .select({
        item: shortlistItems,
        unit: units,
      })
      .from(shortlistItems)
      .leftJoin(units, eq(shortlistItems.unitId, units.id))
      .where(eq(shortlistItems.shortlistId, room.room.id))
      .orderBy(shortlistItems.orderIndex);

    const publicItems = await Promise.all(
      rawItems.map(async r => {
        const project = await inventoryService.getProjectById(room.room.companyId, r.item.projectId);
        return {
          projectId: r.item.projectId,
          matchScore: r.item.matchScore,
          matchHighlights: (r.item.matchHighlights as string[]) || [],
          project,
          recommendedUnit: r.unit
            ? {
                id: r.unit.id,
                companyId: r.unit.companyId,
                projectId: r.unit.projectId,
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
              }
            : null,
        };
      }),
    );

    // Build side-by-side comparison matrix across properties
    const priceMap: Record<string, string> = {};
    const carpetMap: Record<string, string> = {};
    const bhkMap: Record<string, string> = {};
    const possessionMap: Record<string, string> = {};
    const reraMap: Record<string, string> = {};
    const builderMap: Record<string, string> = {};
    const amenitiesCountMap: Record<string, number> = {};

    for (const it of publicItems) {
      const pid = it.projectId;
      priceMap[pid] = it.recommendedUnit ? `₹${(it.recommendedUnit.price / 10000000).toFixed(2)} Cr` : `Starts ₹${it.project.pricingDetails?.startingPrice ? (it.project.pricingDetails.startingPrice / 10000000).toFixed(2) + ' Cr' : 'On Request'}`;
      carpetMap[pid] = it.recommendedUnit ? `${it.recommendedUnit.carpetAreaSqft} sq.ft` : (it.project.floorPlans?.[0] ? `${it.project.floorPlans[0].carpetAreaSqft} sq.ft` : '1000+ sq.ft');
      bhkMap[pid] = it.recommendedUnit ? `${it.recommendedUnit.bhk}BHK` : (it.project.floorPlans?.map(f => f.bhk).join(', ') || '2, 3 BHK');
      possessionMap[pid] = it.project.possessionDate || 'Immediate';
      reraMap[pid] = it.project.reraNo || 'Registered';
      builderMap[pid] = it.project.builderName;
      amenitiesCountMap[pid] = (it.project.amenities || []).length;
    }

    const comparisonMatrix = {
      attributes: [
        { key: 'price', label: 'Price Range / Unit Cost', values: priceMap },
        { key: 'bhk', label: 'Bedrooms (BHK)', values: bhkMap },
        { key: 'carpetArea', label: 'Carpet Area', values: carpetMap },
        { key: 'possession', label: 'Possession Date', values: possessionMap },
        { key: 'developer', label: 'Builder / Developer', values: builderMap },
        { key: 'rera', label: 'RERA Registration', values: reraMap },
        { key: 'amenitiesCount', label: 'Amenities Included', values: amenitiesCountMap },
      ],
    };

    return {
      token,
      title: room.room.title,
      agencyName: room.companyName || 'Real Estate Agency',
      leadFirstName: room.contactFirstName || 'Homebuyer',
      expiresAt: room.room.expiresAt.toISOString(),
      isExpired,
      items: publicItems,
      comparisonMatrix,
    };
  }

  /**
   * Ingests buyer interaction telemetry and updates Lead Intent Score.
   */
  async trackInteraction(
    token: string,
    input: ShortlistTelemetryInput,
  ): Promise<{ success: boolean; intentScoreIncreased: boolean }> {
    const [room] = await db
      .select()
      .from(shortlistRooms)
      .where(eq(shortlistRooms.token, token));

    if (!room) {
      const err = new Error('Room not found');
      Object.assign(err, { statusCode: 404 });
      throw err;
    }

    // 1. Update room statistics
    const isNewView = input.event === 'view';
    const dwellSeconds = input.timeSpentSeconds || 0;

    await db
      .update(shortlistRooms)
      .set({
        viewsCount: isNewView ? sql`${shortlistRooms.viewsCount} + 1` : shortlistRooms.viewsCount,
        lastViewedAt: new Date(),
        totalTimeSpentSeconds: sql`${shortlistRooms.totalTimeSpentSeconds} + ${dwellSeconds}`,
        favoriteProjectId: input.projectId || room.favoriteProjectId,
        updatedAt: new Date(),
      })
      .where(eq(shortlistRooms.id, room.id));

    // 2. Increment item view/dwell if specific project
    if (input.projectId) {
      await db
        .update(shortlistItems)
        .set({
          viewCount: isNewView ? sql`${shortlistItems.viewCount} + 1` : shortlistItems.viewCount,
          timeSpentSeconds: sql`${shortlistItems.timeSpentSeconds} + ${dwellSeconds}`,
        })
        .where(
          and(
            eq(shortlistItems.shortlistId, room.id),
            eq(shortlistItems.projectId, input.projectId),
          ),
        );
    }

    // 3. Log lead activity
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, room.leadId));

    let intentScoreIncreased = false;

    if (lead) {
      await db.insert(leadActivities).values({
        companyId: room.companyId,
        leadId: room.leadId,
        contactId: lead.contactId,
        activityType: 'room_viewed',
        title: `Shortlist Room Viewed: ${room.title}`,
        description: `Lead interacted with room (event: ${input.event}, dwell: ${dwellSeconds}s)`,
        metadata: {
          token,
          event: input.event,
          projectId: input.projectId,
          dwellSeconds,
          metadata: input.metadata || {},
        },
      });

      // Emit domain event
      await db.insert(domainEvents).values({
        companyId: room.companyId,
        type: 'room_viewed',
        payload: {
          lead_id: room.leadId,
          room_token: token,
          time_spent_seconds: dwellSeconds,
        },
      });

      // Raise Intent Score on interaction (+15 for viewing shortlist room)
      const currentScore = lead.intentScore || 0;
      const updatedScore = Math.min(100, currentScore + 15);
      const newPriority = updatedScore >= 70 ? 'high' : updatedScore >= 35 ? 'medium' : 'low';
      const newLabel = updatedScore >= 70 ? 'hot' : updatedScore >= 35 ? 'warm' : 'cold';

      await db
        .update(leads)
        .set({
          intentScore: updatedScore,
          intentLabel: newLabel,
          priority: newPriority,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, room.leadId));

      intentScoreIncreased = updatedScore > currentScore;
    }

    return { success: true, intentScoreIncreased };
  }
}

export const shortlistRoomService = new ShortlistRoomService();
