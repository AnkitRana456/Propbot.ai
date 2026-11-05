import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { projects } from '../../db/schema/index.js';
import type { GenerateReraCopyRequest } from '@propbot/shared';
import { generateText } from '../ai/llm.js';
import { pino } from 'pino';

const logger = pino({ name: 'rera-copy', level: process.env.LOG_LEVEL ?? 'info' });

interface ReraCopyResult {
  isCompliant: boolean;
  violations?: string[];
  generatedCopy?: {
    headline?: string;
    body: string;
    callToAction?: string;
    reraNumber?: string;
    disclaimer?: string;
  };
}

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /guaranteed\s+(return|yield|profit|appreciation|\d+%)/i, label: 'Guaranteed return/profit claim' },
  { pattern: /risk[\s-]free/i, label: 'Risk-free claim' },
  { pattern: /100%\s+assured/i, label: '100% assured claim' },
  { pattern: /assured\s+rental/i, label: 'Assured rental income claim' },
];

export class ReraCopyService {
  async generateCopy(companyId: string, params: GenerateReraCopyRequest): Promise<ReraCopyResult> {
    // Check user-provided draft body for violations first
    if (params.userDraftBody) {
      // Fast regex pre-check
      const lower = params.userDraftBody.toLowerCase();
      const regexViolations: string[] = [];
      for (const { pattern, label } of PROHIBITED_PATTERNS) {
        if (pattern.test(lower)) {
          regexViolations.push(`Prohibited speculative claim: "${label}"`);
        }
      }

      // Deep AI compliance check via Gemini
      const aiCheck = await this.geminiComplianceCheck(params.userDraftBody, params.reraNumber).catch(() => null);
      const aiViolations = aiCheck?.violations ?? [];

      const allViolations = [...new Set([...regexViolations, ...aiViolations])];
      if (allViolations.length > 0) {
        return { isCompliant: false, violations: allViolations };
      }
    }

    // Resolve project name + details — from DB if projectId given, else use form fields
    let projectName = params.projectName || 'Your Project';
    let location = '';
    let builderName = '';
    const reraNumber = params.reraNumber;

    if (params.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, params.projectId), eq(projects.companyId, companyId)))
        .limit(1);
      if (project) {
        projectName = project.name;
        location = project.location || '';
        builderName = project.builderName || '';
      }
    }

    const usps = params.keyUsps || 'Premium amenities, strategic location';
    const audience = params.targetAudience || 'homebuyers';
    const platform = params.platform || 'whatsapp';
    const locationLine = location ? ` in ${location}` : '';
    const builderLine = builderName ? ` by ${builderName}` : '';

    // Generate copy via Gemini
    const aiCopy = await this.geminiGenerateCopy({
      projectName, location, builderName, reraNumber, usps, audience, platform,
      userDraftHeadline: params.userDraftHeadline,
    }).catch(() => null);

    const headline = aiCopy?.headline || params.userDraftHeadline || `Exclusive: ${projectName}`;
    const body = aiCopy?.body || `Namaste! Discover ${projectName}${locationLine}${builderLine}.\n\n${usps}.\n\nProject RERA: ${reraNumber}.`;
    const callToAction = aiCopy?.callToAction || 'Reply YES for floor plans & site visit.';

    logger.info({ projectName, reraNumber, aiUsed: !!aiCopy }, 'Generated RERA-compliant marketing copy');

    return {
      isCompliant: true,
      generatedCopy: {
        headline,
        body,
        callToAction,
        reraNumber,
        disclaimer: `This communication is for informational purposes only and does not constitute an offer or solicitation. RERA Reg: ${reraNumber}.`,
      },
    };
  }

  private async geminiGenerateCopy(p: {
    projectName: string; location: string; builderName: string; reraNumber: string;
    usps: string; audience: string; platform: string; userDraftHeadline?: string;
  }): Promise<{ headline: string; body: string; callToAction: string }> {
    const platformGuide: Record<string, string> = {
      whatsapp: 'WhatsApp message (casual, 50-80 words, conversational Hindi-English mix ok)',
      meta_ads: 'Facebook/Instagram ad (punchy headline, 30-50 word body)',
      google_ads: 'Google Ad (headline max 30 chars, description max 90 chars)',
      email: 'Email body (formal, 80-120 words, professional tone)',
    };
    const guide = platformGuide[p.platform] ?? platformGuide['whatsapp'];

    const result = await generateText({
      systemPrompt: `You are an expert Indian real estate marketing copywriter. Write RERA-compliant copy only — no guaranteed returns, no assured profits, no risk-free claims. Always include the RERA registration number. Respond ONLY with valid JSON.`,
      userMessage: `Write ${guide} for this property:
Project: ${p.projectName}${p.location ? `, ${p.location}` : ''}${p.builderName ? ` by ${p.builderName}` : ''}
RERA Number: ${p.reraNumber}
Key USPs: ${p.usps}
Target Audience: ${p.audience}
${p.userDraftHeadline ? `Suggested headline: ${p.userDraftHeadline}` : ''}

Return JSON: {"headline": "...", "body": "...", "callToAction": "..."}`,
      json: true,
      maxTokens: 500,
      temperature: 0.7,
    });

    const parsed = JSON.parse(result.text) as { headline?: string; body?: string; callToAction?: string };
    if (!parsed.body) throw new Error('Invalid AI response');
    return {
      headline: parsed.headline ?? `Exclusive: ${p.projectName}`,
      body: parsed.body,
      callToAction: parsed.callToAction ?? 'Contact us today.',
    };
  }

  private async geminiComplianceCheck(draftText: string, reraNumber: string): Promise<{ violations: string[] }> {
    const result = await generateText({
      systemPrompt: `You are a RERA (Real Estate Regulatory Authority) compliance expert for India.
Analyze marketing copy for violations of RERA 2016 guidelines.
Respond ONLY with valid JSON in this exact format: {"violations": ["violation1", "violation2"]} or {"violations": []}`,
      userMessage: `Check this real estate marketing copy for RERA compliance violations:

"${draftText}"

RERA Registration Number provided: ${reraNumber}

Flag violations for:
1. Guaranteed returns, profits, or appreciation claims
2. Risk-free investment claims
3. Assured rental income promises
4. Missing or misrepresented RERA registration number
5. Misleading price or possession date claims
6. Unverified amenities or approvals claimed as confirmed
7. Any promise that could mislead a buyer about financial returns

Return only JSON with an array of violation strings (empty array if compliant).`,
      json: true,
      maxTokens: 400,
      temperature: 0.1,
    });

    try {
      const parsed = JSON.parse(result.text) as { violations?: string[] };
      return { violations: parsed.violations ?? [] };
    } catch {
      return { violations: [] };
    }
  }

  validateCopy(text: string, reraNumber: string): { isCompliant: boolean; error?: string } {
    for (const { pattern } of PROHIBITED_PATTERNS) {
      if (pattern.test(text)) {
        return { isCompliant: false, error: 'Marketing copy contains prohibited speculative or guaranteed-return wording.' };
      }
    }
    if (!text.includes(reraNumber)) {
      return { isCompliant: false, error: `Marketing copy must include the official project RERA number (${reraNumber}).` };
    }
    return { isCompliant: true };
  }
}

export const reraCopyService = new ReraCopyService();
