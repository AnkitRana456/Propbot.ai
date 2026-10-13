import { z } from 'zod';

export const projectStatusEnum = z.enum([
  'under_construction',
  'ready_to_move',
  'new_launch',
  'completed',
]);

export const unitStatusEnum = z.enum([
  'available',
  'booked',
  'sold',
  'reserved',
]);

export const unitFacingEnum = z.enum([
  'east',
  'north',
  'west',
  'south',
  'north_east',
  'north_west',
  'park_facing',
  'lake_facing',
  'clubhouse_facing',
  'road_facing',
]);

export const shortlistStatusEnum = z.enum([
  'active',
  'expired',
  'converted',
]);

export const floorPlanSchema = z.object({
  title: z.string().min(1),
  bhk: z.number().int().positive(),
  carpetAreaSqft: z.number().positive(),
  superAreaSqft: z.number().positive().optional(),
  planUrl: z.string().url().or(z.string().min(1)),
});

export const localityInsightsSchema = z.object({
  metro: z.array(z.string()).default([]),
  schools: z.array(z.string()).default([]),
  hospitals: z.array(z.string()).default([]),
  malls: z.array(z.string()).default([]),
  highways: z.array(z.string()).default([]),
});

export const projectPricingDetailsSchema = z.object({
  startingPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  pricePerSqft: z.number().nonnegative().optional(),
  maintenancePerSqft: z.number().nonnegative().optional(),
  tokenAmount: z.number().nonnegative().optional(),
});

// --- Projects Schemas ---

export const projectSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(2).max(255),
  builderName: z.string().min(2).max(255),
  reraNo: z.string().nullable().optional(),
  location: z.string().min(2).max(255),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  mapUrl: z.string().nullable().optional(),
  status: projectStatusEnum,
  possessionDate: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  amenities: z.array(z.string()).default([]),
  usps: z.array(z.string()).default([]),
  gallery: z.array(z.string()).default([]),
  videoTourUrl: z.string().nullable().optional(),
  floorPlans: z.array(floorPlanSchema).default([]),
  priceSheetUrl: z.string().nullable().optional(),
  paymentPlans: z.array(z.string()).default([]),
  offers: z.array(z.string()).default([]),
  localityInsights: localityInsightsSchema.default({}),
  pricingDetails: projectPricingDetailsSchema.default({}),
  totalUnitsCount: z.number().int().nonnegative().optional(),
  availableUnitsCount: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createProjectInputSchema = z.object({
  name: z.string().min(2).max(255),
  builderName: z.string().min(2).max(255),
  reraNo: z.string().max(100).optional(),
  location: z.string().min(2).max(255),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mapUrl: z.string().url().or(z.string().min(1)).optional(),
  status: projectStatusEnum.default('under_construction').optional(),
  possessionDate: z.string().max(100).optional(),
  overview: z.string().optional(),
  amenities: z.array(z.string()).default([]).optional(),
  usps: z.array(z.string()).default([]).optional(),
  gallery: z.array(z.string()).default([]).optional(),
  videoTourUrl: z.string().url().or(z.string().min(1)).optional(),
  floorPlans: z.array(floorPlanSchema).default([]).optional(),
  priceSheetUrl: z.string().url().or(z.string().min(1)).optional(),
  paymentPlans: z.array(z.string()).default([]).optional(),
  offers: z.array(z.string()).default([]).optional(),
  localityInsights: localityInsightsSchema.default({}).optional(),
  pricingDetails: projectPricingDetailsSchema.default({}).optional(),
});

export const updateProjectInputSchema = createProjectInputSchema.partial();

export const projectsListResponseSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

// --- Units Schemas ---

export const unitSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  projectName: z.string().optional(),
  tower: z.string().nullable().optional(),
  floor: z.number().int().nullable().optional(),
  unitNumber: z.string().min(1).max(50),
  bhk: z.number().int().positive(),
  carpetAreaSqft: z.number().positive(),
  superAreaSqft: z.number().positive().nullable().optional(),
  price: z.number().positive(),
  status: unitStatusEnum,
  facing: z.string().nullable().optional(),
  furnishing: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createUnitInputSchema = z.object({
  tower: z.string().max(100).optional(),
  floor: z.number().int().optional(),
  unitNumber: z.string().min(1).max(50),
  bhk: z.number().int().positive(),
  carpetAreaSqft: z.number().positive(),
  superAreaSqft: z.number().positive().optional(),
  price: z.number().positive(),
  status: unitStatusEnum.default('available').optional(),
  facing: z.string().max(50).optional(),
  furnishing: z.string().max(50).optional(),
});

export const updateUnitInputSchema = createUnitInputSchema.partial();

export const unitsListResponseSchema = z.object({
  items: z.array(unitSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
});

// --- Bulk Import CSV / XLSX ---

export const bulkImportUnitRowSchema = z.object({
  tower: z.string().optional(),
  floor: z.union([z.number().int(), z.string()]).optional(),
  unitNumber: z.string().min(1),
  bhk: z.union([z.number().int(), z.string()]),
  carpetAreaSqft: z.union([z.number(), z.string()]),
  superAreaSqft: z.union([z.number(), z.string()]).optional(),
  price: z.union([z.number(), z.string()]),
  status: unitStatusEnum.default('available'),
  facing: z.string().optional(),
  furnishing: z.string().optional(),
});

export const bulkImportUnitsInputSchema = z.object({
  csvContent: z.string().min(1).optional(),
  units: z.array(bulkImportUnitRowSchema).optional(),
});

export const bulkImportReportSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  importedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      row: z.number().int().positive(),
      unitNumber: z.string().optional(),
      error: z.string(),
    }),
  ),
});

// --- Brochures ---

export const brochureSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  projectName: z.string().optional(),
  title: z.string().min(1).max(255),
  fileUrl: z.string().min(1),
  isGated: z.boolean(),
  downloadCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBrochureInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  fileUrl: z.string().min(1),
  isGated: z.boolean().default(true),
});

export const requestBrochureInputSchema = z.object({
  leadId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const requestBrochureResponseSchema = z.object({
  gated: z.boolean(),
  requiredFields: z.array(z.string()).optional(),
  downloadUrl: z.string().optional(),
  trackingToken: z.string().optional(),
  brochure: brochureSchema.optional(),
});

// --- Bot Property Search Tool ---

export const propertySearchInputSchema = z.object({
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  bhk: z.union([z.number().int(), z.array(z.number().int())]).optional(),
  locality: z.string().optional(),
  status: projectStatusEnum.optional(),
  propertyType: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const propertyCardResponseSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string(),
  builderName: z.string(),
  location: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: projectStatusEnum,
  possessionDate: z.string().nullable().optional(),
  startingPrice: z.number().optional(),
  priceRange: z.string(),
  bhkOptions: z.array(z.number().int()),
  carpetAreaRange: z.string(),
  heroImage: z.string().nullable().optional(),
  gallery: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  usps: z.array(z.string()).default([]),
  reraNo: z.string().nullable().optional(),
  availableUnitsCount: z.number().int().nonnegative(),
  brochureUrl: z.string().nullable().optional(),
  videoTourUrl: z.string().nullable().optional(),
  matchScore: z.number().int().min(0).max(100).optional(),
  matchHighlights: z.array(z.string()).optional(),
});

// --- Smart Shortlist Room ---

export const createShortlistRoomInputSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(2).max(255).optional(),
  projectIds: z.array(z.string().uuid()).min(1).max(10).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const shortlistRoomItemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  unitId: z.string().uuid().nullable().optional(),
  orderIndex: z.number().int().nonnegative(),
  matchScore: z.number().int().min(0).max(100),
  matchHighlights: z.array(z.string()).default([]),
  project: projectSchema,
  recommendedUnit: unitSchema.nullable().optional(),
});

export const shortlistRoomResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  leadId: z.string().uuid(),
  token: z.string(),
  title: z.string(),
  matchedPreferences: z.record(z.unknown()),
  expiresAt: z.string().datetime(),
  viewsCount: z.number().int().nonnegative(),
  lastViewedAt: z.string().datetime().nullable().optional(),
  totalTimeSpentSeconds: z.number().int().nonnegative(),
  favoriteProjectId: z.string().uuid().nullable().optional(),
  status: shortlistStatusEnum,
  items: z.array(shortlistRoomItemSchema),
  shareableUrl: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const shortlistRoomPublicResponseSchema = z.object({
  token: z.string(),
  title: z.string(),
  agencyName: z.string(),
  leadFirstName: z.string(),
  expiresAt: z.string().datetime(),
  isExpired: z.boolean(),
  items: z.array(
    z.object({
      projectId: z.string().uuid(),
      matchScore: z.number().int(),
      matchHighlights: z.array(z.string()),
      project: projectSchema,
      recommendedUnit: unitSchema.nullable().optional(),
    }),
  ),
  comparisonMatrix: z.object({
    attributes: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
      }),
    ),
  }),
});

export const shortlistTelemetryInputSchema = z.object({
  event: z.enum([
    'view',
    'dwell',
    'compare',
    'emi_calc',
    'focus_project',
    'callback_request',
    'visit_request',
    'share',
  ]),
  projectId: z.string().uuid().optional(),
  timeSpentSeconds: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});
