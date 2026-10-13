import { z } from 'zod';
import type {
  projectStatusEnum,
  unitStatusEnum,
  unitFacingEnum,
  shortlistStatusEnum,
  floorPlanSchema,
  localityInsightsSchema,
  projectPricingDetailsSchema,
  projectSchema,
  createProjectInputSchema,
  updateProjectInputSchema,
  projectsListResponseSchema,
  unitSchema,
  createUnitInputSchema,
  updateUnitInputSchema,
  unitsListResponseSchema,
  bulkImportUnitRowSchema,
  bulkImportUnitsInputSchema,
  bulkImportReportSchema,
  brochureSchema,
  createBrochureInputSchema,
  requestBrochureInputSchema,
  requestBrochureResponseSchema,
  propertySearchInputSchema,
  propertyCardResponseSchema,
  createShortlistRoomInputSchema,
  shortlistRoomItemSchema,
  shortlistRoomResponseSchema,
  shortlistRoomPublicResponseSchema,
  shortlistTelemetryInputSchema,
} from '../schemas/inventory.js';

export type ProjectStatus = z.infer<typeof projectStatusEnum>;
export type UnitStatus = z.infer<typeof unitStatusEnum>;
export type UnitFacing = z.infer<typeof unitFacingEnum>;
export type ShortlistStatus = z.infer<typeof shortlistStatusEnum>;

export type FloorPlan = z.infer<typeof floorPlanSchema>;
export type LocalityInsights = z.infer<typeof localityInsightsSchema>;
export type ProjectPricingDetails = z.infer<typeof projectPricingDetailsSchema>;

export type ProjectItem = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
export type ProjectsListResponse = z.infer<typeof projectsListResponseSchema>;

export type UnitItem = z.infer<typeof unitSchema>;
export type CreateUnitInput = z.infer<typeof createUnitInputSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitInputSchema>;
export type UnitsListResponse = z.infer<typeof unitsListResponseSchema>;

export type BulkImportUnitRow = z.infer<typeof bulkImportUnitRowSchema>;
export type BulkImportUnitsInput = z.infer<typeof bulkImportUnitsInputSchema>;
export type BulkImportReport = z.infer<typeof bulkImportReportSchema>;

export type PropertyBrochureItem = z.infer<typeof brochureSchema>;
export type CreateBrochureInput = z.infer<typeof createBrochureInputSchema>;
export type RequestBrochureInput = z.infer<typeof requestBrochureInputSchema>;
export type RequestBrochureResponse = z.infer<typeof requestBrochureResponseSchema>;

export type PropertySearchInput = z.infer<typeof propertySearchInputSchema>;
export type PropertyCardResponse = z.infer<typeof propertyCardResponseSchema>;

export type CreateShortlistRoomInput = z.infer<typeof createShortlistRoomInputSchema>;
export type ShortlistRoomItem = z.infer<typeof shortlistRoomItemSchema>;
export type ShortlistRoomResponse = z.infer<typeof shortlistRoomResponseSchema>;
export type ShortlistRoomPublicResponse = z.infer<typeof shortlistRoomPublicResponseSchema>;
export type ShortlistTelemetryInput = z.infer<typeof shortlistTelemetryInputSchema>;
