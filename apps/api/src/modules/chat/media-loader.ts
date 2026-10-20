import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatbots, messages, projects } from '../../db/schema/index.js';
import {
  buildMediaItems,
  detectMediaKinds,
  type MediaItem,
  type MediaProject,
} from './media-triggers.js';

type ProjectRow = typeof projects.$inferSelect;

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function toMediaProject(row: ProjectRow): MediaProject {
  const plans = Array.isArray(row.floorPlans) ? (row.floorPlans as Array<Record<string, unknown>>) : [];
  return {
    name: row.name,
    location: row.location,
    highlightPhotos: asStrings(row.highlightPhotos),
    gallery: asStrings(row.gallery),
    floorPlans: plans
      .filter(p => typeof p?.planUrl === 'string')
      .map(p => ({
        title: String(p.title ?? 'Floor plan'),
        bhk: Number(p.bhk) || 0,
        carpetAreaSqft: p.carpetAreaSqft ? Number(p.carpetAreaSqft) : undefined,
        planUrl: String(p.planUrl),
      })),
    masterPlanUrl: row.masterPlanUrl ?? null,
    mapUrl: row.mapUrl ?? null,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
  };
}

/**
 * Chatbots are not linked to projects, so the project is resolved in this order:
 *  1. a project whose name the visitor mentioned in this message,
 *  2. `chatbot.config.mediaProjectId`,
 *  3. the company's only project, else its most recently updated one.
 */
export async function resolveMediaProject(
  companyId: string,
  chatbotId: string,
  message: string,
): Promise<MediaProject | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.companyId, companyId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.updatedAt))
    .limit(50);
  if (rows.length === 0) return null;

  const lower = message.toLowerCase();
  const mentioned = rows.find(r => r.name.length >= 3 && lower.includes(r.name.toLowerCase()));
  if (mentioned) return toMediaProject(mentioned);

  const [bot] = await db.select({ config: chatbots.config }).from(chatbots).where(eq(chatbots.id, chatbotId));
  const configured = (bot?.config as { mediaProjectId?: string } | undefined)?.mediaProjectId;
  const pinned = configured ? rows.find(r => r.id === configured) : undefined;
  return toMediaProject(pinned ?? rows[0]!);
}

/** Media for one visitor message. Returns [] when nothing was triggered or the project has no matching media. */
export async function loadMediaForMessage(params: {
  companyId: string;
  chatbotId: string;
  conversationId: string;
  message: string;
}): Promise<MediaItem[]> {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.conversationId, params.conversationId), eq(messages.senderType, 'visitor')));
  const isFirstMessage = n <= 1;

  const kinds = detectMediaKinds(params.message, isFirstMessage);
  if (kinds.length === 0) return [];

  const project = await resolveMediaProject(params.companyId, params.chatbotId, params.message);
  if (!project) return [];
  return buildMediaItems(kinds, project, params.message);
}
