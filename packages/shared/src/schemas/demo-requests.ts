import { z } from 'zod';

/** Public "book a demo" form on the marketing site. */
export const createDemoRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid work email').max(190),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 -]{8,16}$/, 'Enter a valid mobile number'),
  agency: z.string().trim().min(2, 'Enter your agency name').max(160),
  listings: z.enum(['1-50', '51-200', '201-1000', '1000+']),
  /** Honeypot: real people leave it empty, bots fill it. */
  website: z.string().max(200).optional(),
});
export type CreateDemoRequestInput = z.infer<typeof createDemoRequestSchema>;
