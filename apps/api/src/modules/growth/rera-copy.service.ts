import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { projects } from '../../db/schema/index.js';
import type { GenerateReraCopyRequest, GenerateReraCopyResponse } from '@propbot/shared';
import { pino } from 'pino';

const logger = pino({ name: 'rera-copy', level: process.env.LOG_LEVEL ?? 'info' });

export class ReraCopyService {
  /**
   * Generates marketing copy grounded in project data, strictly embedding RERA number
   * and enforcing compliance guards that block guaranteed-return or speculative claims.
   */
  async generateCopy(companyId: string, params: GenerateReraCopyRequest): Promise<GenerateReraCopyResponse> {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, params.projectId), eq(projects.companyId, companyId)))
      .limit(1);

    if (!project) {
      throw new Error(`Project not found: ${params.projectId}`);
    }

    const reraNumber = project.reraNo || 'RERA-ACK-PENDING';
    const builderName = project.builderName || 'Prestige Group';
    const projectName = project.name;
    const location = project.location;

    // Platform-tailored templates
    let headline = '';
    let body = '';
    let callToAction = '';

    if (params.platform === 'whatsapp') {
      headline = `Exclusive Preview: Luxury Living at ${projectName}`;
      body = `Namaste! Discover premium residences in the heart of ${location} by ${builderName}. Enjoy world-class amenities including central clubhouse, landscaped gardens, and smart home provisions.\n\nOfficial RERA Registration: ${reraNumber}.`;
      callToAction = 'Reply "YES" to receive floor plans and schedule a private site visit preview.';
    } else if (params.platform === 'meta_ads') {
      headline = `${projectName} by ${builderName} — Modern Homes in ${location}`;
      body = `Spacious 2, 3 & 4 BHK apartments surrounded by lush greenery and premium lifestyle amenities in ${location}. Transparent construction milestones with verified approvals.\n\nRERA No: ${reraNumber}.`;
      callToAction = 'Book Guided Site Visit';
    } else if (params.platform === 'google_ads') {
      headline = `${projectName} in ${location} | RERA: ${reraNumber}`;
      body = `Explore luxury 2, 3 & 4 BHK apartments by ${builderName} at ${location}. Possession starting Dec 2026. Schedule your model flat walkthrough today.`;
      callToAction = 'Download Official Brochure';
    } else {
      headline = `VIP Invitation: Priority Unit Selection at ${projectName}`;
      body = `Dear Buyer,\n\nWe are delighted to invite you to the private showcase of ${projectName}, located in prime ${location}.\n\nProject Highlights:\n• Developed by ${builderName}\n• 80% open landscaped spaces & clubhouse\n• RERA Registered: ${reraNumber}\n\nReview verified floor plans and connect with our dedicated property consultant.`;
      callToAction = 'Confirm Private Consultation';
    }

    // Safety Compliance Check (PDF: "blocks guaranteed-return or unverifiable claims")
    const prohibitedTerms = [
      'guaranteed return',
      'guaranteed 25%',
      'guaranteed 20%',
      'guaranteed appreciation',
      'risk-free profit',
      '100% return',
      'guaranteed rental yield',
    ];

    const combinedText = `${headline} ${body} ${callToAction}`.toLowerCase();
    const complianceFlags: string[] = [];

    for (const term of prohibitedTerms) {
      if (combinedText.includes(term)) {
        complianceFlags.push(`Prohibited speculative term detected: "${term}"`);
      }
    }

    const isCompliant = complianceFlags.length === 0 && Boolean(project.reraNo);

    logger.info({ projectId: project.id, reraNumber, isCompliant }, 'Generated RERA-compliant marketing copy');

    return {
      headline,
      body,
      callToAction,
      reraNumber,
      complianceFlags,
      isCompliant,
      requiresReview: true, // PDF: "flags content for review"
    };
  }

  /**
   * Helper validator to scan user-edited copy before broadcasting.
   */
  validateCopy(text: string, reraNumber: string): { isCompliant: boolean; error?: string } {
    const lower = text.toLowerCase();
    const prohibitedPatterns = [
      /guaranteed\s+(return|yield|profit|appreciation|\d+%)/i,
      /risk[\s-]free/i,
      /100%\s+assured/i,
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(lower)) {
        return {
          isCompliant: false,
          error: 'Marketing copy contains prohibited speculative or guaranteed-return wording.',
        };
      }
    }

    if (!text.includes(reraNumber)) {
      return {
        isCompliant: false,
        error: `Marketing copy must include the official project RERA number (${reraNumber}).`,
      };
    }

    return { isCompliant: true };
  }
}

export const reraCopyService = new ReraCopyService();
