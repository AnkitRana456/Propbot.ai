import type { BuyerDna } from '@propbot/shared';
import { modelRouter, TaskTier } from '../ai/router.js';

export class BuyerDnaService {
  /**
   * Default initial Buyer DNA structure.
   */
  getDefaultDna(): BuyerDna {
    return {
      budgetMin: null,
      budgetMax: null,
      bhk: [],
      localities: [],
      propertyType: null,
      purpose: null,
      timeline: null,
      financing: null,
      familySize: null,
      mustHaves: [],
      dealBreakers: [],
      objections: [],
      competitorsMentioned: [],
      language: 'en',
      confidence: {},
      explicitFields: [],
    };
  }

  /**
   * Deterministic rule-based extraction fallback.
   * Handles common real estate terminology, budgets (Cr / Lakhs), BHK configurations, etc.
   */
  extractWithRules(message: string): Partial<BuyerDna> & { explicitFields: string[] } {
    const text = message.toLowerCase();
    const extracted: Partial<BuyerDna> = {};
    const explicitFields: string[] = [];

    // 1. Budget extraction (supports Indian formats: Cr, Crore, Lakhs, L)
    const crMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
    const singleCrMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
    const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)\b/i);
    const singleLakhMatch = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)\b/i);

    if (crMatch && crMatch[1] && crMatch[2]) {
      extracted.budgetMin = Math.round(parseFloat(crMatch[1]) * 10000000);
      extracted.budgetMax = Math.round(parseFloat(crMatch[2]) * 10000000);
      explicitFields.push('budgetMin', 'budgetMax');
    } else if (singleCrMatch && singleCrMatch[1]) {
      extracted.budgetMax = Math.round(parseFloat(singleCrMatch[1]) * 10000000);
      explicitFields.push('budgetMax');
    } else if (lakhMatch && lakhMatch[1] && lakhMatch[2]) {
      extracted.budgetMin = Math.round(parseFloat(lakhMatch[1]) * 100000);
      extracted.budgetMax = Math.round(parseFloat(lakhMatch[2]) * 100000);
      explicitFields.push('budgetMin', 'budgetMax');
    } else if (singleLakhMatch && singleLakhMatch[1]) {
      extracted.budgetMax = Math.round(parseFloat(singleLakhMatch[1]) * 100000);
      explicitFields.push('budgetMax');
    }

    // 2. BHK extraction
    const bhkMatches = Array.from(text.matchAll(/\b([1-6])\s*(?:bhk|bedroom|bed)\b/gi)).map(
      m => `${m[1]}BHK`,
    );
    if (bhkMatches.length > 0) {
      extracted.bhk = Array.from(new Set(bhkMatches));
      explicitFields.push('bhk');
    } else if (text.includes('studio')) {
      extracted.bhk = ['Studio'];
      explicitFields.push('bhk');
    }

    // 3. Property Type
    if (text.includes('villa') || text.includes('villas')) {
      extracted.propertyType = 'villa';
      explicitFields.push('propertyType');
    } else if (text.includes('penthouse')) {
      extracted.propertyType = 'penthouse';
      explicitFields.push('propertyType');
    } else if (text.includes('plot') || text.includes('land')) {
      extracted.propertyType = 'plot';
      explicitFields.push('propertyType');
    } else if (text.includes('apartment') || text.includes('flat')) {
      extracted.propertyType = 'apartment';
      explicitFields.push('propertyType');
    }

    // 4. Purpose
    if (text.includes('invest') || text.includes('investment') || text.includes('roi')) {
      extracted.purpose = 'investment';
      explicitFields.push('purpose');
    } else if (text.includes('rental') || text.includes('rent out')) {
      extracted.purpose = 'rental';
      explicitFields.push('purpose');
    } else if (
      text.includes('move in') ||
      text.includes('end use') ||
      text.includes('family') ||
      text.includes('own use') ||
      text.includes('stay')
    ) {
      extracted.purpose = 'end_use';
      explicitFields.push('purpose');
    }

    // 5. Timeline
    if (text.includes('ready to move') || text.includes('immediate') || text.includes('urgently')) {
      extracted.timeline = 'immediate';
      explicitFields.push('timeline');
    } else if (text.includes('3 months') || text.includes('quarter')) {
      extracted.timeline = '3_months';
      explicitFields.push('timeline');
    } else if (text.includes('6 months') || text.includes('half year')) {
      extracted.timeline = '6_months';
      explicitFields.push('timeline');
    } else if (text.includes('1 year') || text.includes('next year') || text.includes('2027')) {
      extracted.timeline = '1_year';
      explicitFields.push('timeline');
    } else if (text.includes('flexible')) {
      extracted.timeline = 'flexible';
      explicitFields.push('timeline');
    }

    // 6. Financing
    if (text.includes('pre-approved') || text.includes('pre approved')) {
      extracted.financing = 'pre_approved';
      explicitFields.push('financing');
    } else if (text.includes('home loan') || text.includes('bank loan') || text.includes('loan')) {
      extracted.financing = 'bank_loan';
      explicitFields.push('financing');
    } else if (text.includes('self funded') || text.includes('cash') || text.includes('own funds')) {
      extracted.financing = 'self_funded';
      explicitFields.push('financing');
    }

    // 7. Family Size
    const familyMatch = text.match(/(?:family of|we are|total of)\s*(\d+)/);
    if (familyMatch && familyMatch[1]) {
      extracted.familySize = parseInt(familyMatch[1], 10);
      explicitFields.push('familySize');
    }

    // 8. Localities (common real estate regions)
    const knownLocalities = [
      'whitefield',
      'sarjapur',
      'indiranagar',
      'koramangala',
      'hebbal',
      'yelahanka',
      'bellandur',
      'electronic city',
      'hsr layout',
      'kanakapura',
      'thanisandra',
      'devanahalli',
      'marathahalli',
    ];
    const foundLocalities = knownLocalities.filter(loc => text.includes(loc));
    if (foundLocalities.length > 0) {
      extracted.localities = foundLocalities.map(l => l.charAt(0).toUpperCase() + l.slice(1));
      explicitFields.push('localities');
    }

    // 9. Must Haves & Amenities
    const mustHavesKeywords = [
      { key: 'private garden', label: 'Private Garden' },
      { key: 'garden', label: 'Garden' },
      { key: 'clubhouse', label: 'Clubhouse' },
      { key: 'swimming pool', label: 'Swimming Pool' },
      { key: 'pool', label: 'Swimming Pool' },
      { key: 'gym', label: 'Gymnasium' },
      { key: 'east facing', label: 'East Facing' },
      { key: 'vastu', label: 'Vaastu Compliant' },
      { key: 'servant quarter', label: 'Servant Room' },
      { key: 'servant room', label: 'Servant Room' },
      { key: 'maid room', label: 'Servant Room' },
      { key: 'balcony', label: 'Spacious Balcony' },
    ];
    const foundMustHaves = mustHavesKeywords
      .filter(item => text.includes(item.key))
      .map(item => item.label);
    if (foundMustHaves.length > 0) {
      extracted.mustHaves = Array.from(new Set(foundMustHaves));
      explicitFields.push('mustHaves');
    }

    // 10. Deal Breakers
    if (text.includes('no high rise') || text.includes('not above 10th floor')) {
      extracted.dealBreakers = ['High Rise Restrictions'];
      explicitFields.push('dealBreakers');
    } else if (text.includes('cannot wait') || text.includes('no delayed')) {
      extracted.dealBreakers = ['Delayed Possession'];
      explicitFields.push('dealBreakers');
    }

    // 11. Objections
    if (
      text.includes('expensive') ||
      text.includes('too high') ||
      text.includes('price is high') ||
      text.includes('costly')
    ) {
      extracted.objections = ['Pricing exceeds initial expectations'];
      explicitFields.push('objections');
    }
    if (text.includes('far from metro') || text.includes('traffic')) {
      extracted.objections = [...(extracted.objections ?? []), 'Location connectivity / traffic'];
      explicitFields.push('objections');
    }

    // 12. Competitors
    const competitors = ['sobha', 'godrej', 'brigade', 'puravankara', 'prestige', 'lodha'];
    const foundCompetitors = competitors
      .filter(comp => text.includes(comp))
      .map(c => c.charAt(0).toUpperCase() + c.slice(1));
    if (foundCompetitors.length > 0) {
      extracted.competitorsMentioned = foundCompetitors;
      explicitFields.push('competitorsMentioned');
    }

    return {
      ...extracted,
      explicitFields,
    };
  }

  /**
   * Extracts and merges Buyer DNA from a message into existing Buyer DNA.
   * Leverages FAST LLM tier if available, falling back seamlessly to deterministic extractor.
   */
  async extractFromMessage(
    companyId: string,
    chatbotId: string,
    message: string,
    existingDna?: BuyerDna | null,
  ): Promise<BuyerDna> {
    const current = existingDna ?? this.getDefaultDna();

    let extracted: Partial<BuyerDna> = {};
    let explicitFields: string[] = [];

    // Try FAST model extraction via ModelRouter
    try {
      const systemPrompt = `You are an expert real estate AI assistant that extracts structured buyer preferences (Buyer DNA) from conversation messages.
Return ONLY valid JSON with keys:
budgetMin (number or null),
budgetMax (number or null),
bhk (array of strings, e.g. ["3BHK"]),
localities (array of strings),
propertyType ("villa"|"apartment"|"penthouse"|"plot"|null),
purpose ("end_use"|"investment"|"rental"|null),
timeline ("immediate"|"3_months"|"6_months"|"1_year"|"flexible"|null),
financing ("self_funded"|"bank_loan"|"pre_approved"|null),
familySize (number or null),
mustHaves (array of strings),
dealBreakers (array of strings),
objections (array of strings),
competitorsMentioned (array of strings),
language (string, default "en"),
confidence (object mapping updated keys to 0.0-1.0),
explicitFields (array of keys explicitly confirmed by the user).`;

      const result = await modelRouter.call({
        tier: TaskTier.FAST,
        companyId,
        chatbotId,
        systemPrompt,
        userMessage: `Visitor message: "${message}"`,
        maxTokens: 400,
        temperature: 0.1,
      });

      if (result.provider !== 'fallback_offline') {
        const parsed = JSON.parse(result.text) as Partial<BuyerDna> & { explicitFields?: string[] };
        extracted = parsed;
        explicitFields = parsed.explicitFields ?? [];
      } else {
        // Fallback offline router returned mock text: run deterministic rule engine
        const ruleResult = this.extractWithRules(message);
        extracted = ruleResult;
        explicitFields = ruleResult.explicitFields;
      }
    } catch {
      // In case of any parsing or LLM failure, run deterministic rule engine
      const ruleResult = this.extractWithRules(message);
      extracted = ruleResult;
      explicitFields = ruleResult.explicitFields;
    }

    // Merge extracted data into current Buyer DNA
    return this.mergeDna(current, extracted, explicitFields);
  }

  /**
   * Merges extracted facts into existing Buyer DNA.
   * Handles user corrections (explicit statements overwrite previous facts).
   */
  mergeDna(
    current: BuyerDna,
    updates: Partial<BuyerDna>,
    explicitFields: string[] = [],
  ): BuyerDna {
    const updated = { ...current };
    const conf = { ...(current.confidence ?? {}) };
    const currentExplicit = new Set(current.explicitFields ?? []);

    // Helper to merge or overwrite fields
    const updateField = <K extends keyof BuyerDna>(
      key: K,
      val: BuyerDna[K] | undefined,
      defaultConf = 0.9,
    ) => {
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          if (val.length > 0) {
            // If explicit correction, overwrite array; otherwise merge unique
            if (explicitFields.includes(key as string)) {
              (updated[key] as unknown) = val;
            } else {
              const merged = Array.from(new Set([...((updated[key] as string[]) || []), ...val]));
              (updated[key] as unknown) = merged;
            }
            conf[key as string] = defaultConf;
          }
        } else {
          (updated[key] as unknown) = val;
          conf[key as string] = defaultConf;
        }

        if (explicitFields.includes(key as string)) {
          currentExplicit.add(key as string);
          conf[key as string] = 1.0;
        }
      }
    };

    updateField('budgetMin', updates.budgetMin);
    updateField('budgetMax', updates.budgetMax);
    updateField('bhk', updates.bhk);
    updateField('localities', updates.localities);
    updateField('propertyType', updates.propertyType);
    updateField('purpose', updates.purpose);
    updateField('timeline', updates.timeline);
    updateField('financing', updates.financing);
    updateField('familySize', updates.familySize);
    updateField('mustHaves', updates.mustHaves);
    updateField('dealBreakers', updates.dealBreakers);
    updateField('objections', updates.objections);
    updateField('competitorsMentioned', updates.competitorsMentioned);
    updateField('language', updates.language);

    updated.confidence = conf;
    updated.explicitFields = Array.from(currentExplicit);

    return updated;
  }
}

export const buyerDnaService = new BuyerDnaService();
