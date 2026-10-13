export interface DetectedLanguage {
  code: string; // ISO code or language tag, e.g. 'en', 'hi', 'hi-Latn', 'mr', 'ta', 'te', 'kn', 'bn', 'gu', 'ar'
  name: string; // 'English', 'Hindi', 'Hinglish', etc.
  confidence: number; // 0 to 1
  isRtl?: boolean;
}

export class LanguageDetectorService {
  private readonly HINGLISH_KEYWORDS = new Set([
    'kya', 'hai', 'kitna', 'kitne', 'chahiye', 'batao', 'bataye', 'batayein', 'bataiye',
    'kab', 'milega', 'kaise', 'kaisa', 'dekhna', 'lena', 'dena', 'achha', 'accha',
    'namaste', 'dhanyawad', 'shukriya', 'rate', 'bhav', 'plot', 'makan', 'ghar',
    'kaha', 'kahan', 'bhi', 'aur', 'toh', 'mujhe', 'humko', 'aapka', 'aapse', 'hoga',
    'sakte', 'sakta', 'baat', 'karni', 'karna', 'poochhna', 'puchna', 'booking',
    'mil', 'raha', 'rahi', 'discount', 'milenga', 'milenge', 'flat', 'villa'
  ]);

  private readonly MARATHI_MARKERS = [
    'आहे', 'नाही', 'काय', 'किती', 'कधी', 'पाहिजे', 'सांगा', 'फ्लॅट', 'घर', 'करा', 'होय'
  ];

  detectLanguage(text: string): DetectedLanguage {
    if (!text || text.trim().length === 0) {
      return { code: 'en', name: 'English', confidence: 1.0 };
    }

    const trimmed = text.trim();

    // 1. Script-based Unicode block checks
    const arabicMatch = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
    const devanagariMatch = (trimmed.match(/[\u0900-\u097F]/g) || []).length;
    const tamilMatch = (trimmed.match(/[\u0B80-\u0BFF]/g) || []).length;
    const teluguMatch = (trimmed.match(/[\u0C00-\u0C7F]/g) || []).length;
    const kannadaMatch = (trimmed.match(/[\u0C80-\u0CFF]/g) || []).length;
    const bengaliMatch = (trimmed.match(/[\u0980-\u09FF]/g) || []).length;
    const gujaratiMatch = (trimmed.match(/[\u0A80-\u0AFF]/g) || []).length;

    const totalChars = trimmed.replace(/\s+/g, '').length;

    if (arabicMatch > totalChars * 0.25) {
      return { code: 'ar', name: 'Arabic', confidence: Math.min(1, arabicMatch / totalChars + 0.3), isRtl: true };
    }
    if (tamilMatch > totalChars * 0.25) {
      return { code: 'ta', name: 'Tamil', confidence: Math.min(1, tamilMatch / totalChars + 0.3) };
    }
    if (teluguMatch > totalChars * 0.25) {
      return { code: 'te', name: 'Telugu', confidence: Math.min(1, teluguMatch / totalChars + 0.3) };
    }
    if (kannadaMatch > totalChars * 0.25) {
      return { code: 'kn', name: 'Kannada', confidence: Math.min(1, kannadaMatch / totalChars + 0.3) };
    }
    if (bengaliMatch > totalChars * 0.25) {
      return { code: 'bn', name: 'Bengali', confidence: Math.min(1, bengaliMatch / totalChars + 0.3) };
    }
    if (gujaratiMatch > totalChars * 0.25) {
      return { code: 'gu', name: 'Gujarati', confidence: Math.min(1, gujaratiMatch / totalChars + 0.3) };
    }

    // Devanagari script (Hindi vs Marathi)
    if (devanagariMatch > totalChars * 0.25) {
      const isMarathi = this.MARATHI_MARKERS.some(marker => trimmed.includes(marker));
      if (isMarathi) {
        return { code: 'mr', name: 'Marathi', confidence: 0.95 };
      }
      return { code: 'hi', name: 'Hindi', confidence: Math.min(1, devanagariMatch / totalChars + 0.3) };
    }

    // 2. Latin-script text: Hinglish check
    const words = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

    if (words.length > 0) {
      const hinglishCount = words.filter(w => this.HINGLISH_KEYWORDS.has(w)).length;
      const hinglishRatio = hinglishCount / words.length;

      if (hinglishCount >= 2 || (words.length <= 4 && hinglishCount >= 1 && hinglishRatio >= 0.25)) {
        return { code: 'hi-Latn', name: 'Hinglish', confidence: Math.min(1, 0.6 + hinglishRatio * 0.4) };
      }
    }

    // Default to English
    return { code: 'en', name: 'English', confidence: 0.9 };
  }

  getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      'hi-Latn': 'Hinglish',
      mr: 'Marathi',
      ta: 'Tamil',
      te: 'Telugu',
      kn: 'Kannada',
      bn: 'Bengali',
      gu: 'Gujarati',
      ar: 'Arabic',
    };
    return names[code] || 'English';
  }

  isAllowedLanguage(code: string, allowedLanguages: string[] = []): boolean {
    if (!allowedLanguages || allowedLanguages.length === 0) return true;
    return allowedLanguages.includes(code);
  }

  getLanguageDirective(code: string, allowedLanguages: string[] = []): string {
    const isAllowed = this.isAllowedLanguage(code, allowedLanguages);
    const targetCode = isAllowed ? code : 'en';

    if (targetCode === 'hi') {
      return 'Respond entirely in natural, polished Hindi (Devanagari script). Keep all RERA IDs, numbers, and currency values verbatim in Indian standards (₹, Lakhs, Cr).';
    }
    if (targetCode === 'hi-Latn') {
      return 'Respond in conversational, fluent Hinglish (Hindi written in Latin script). Keep all RERA IDs, numbers, and currency units verbatim.';
    }
    if (targetCode === 'mr') {
      return 'Respond entirely in natural, polished Marathi (Devanagari script). Keep all numbers and RERA IDs verbatim.';
    }
    if (targetCode === 'ar') {
      return 'Respond in natural, professional Arabic. Keep all numbers and RERA IDs verbatim.';
    }
    if (targetCode !== 'en') {
      const name = this.getLanguageName(targetCode);
      return `Respond in natural, professional ${name}. Keep all RERA IDs, property names, and numbers verbatim.`;
    }
    return 'Respond in professional, engaging English. Keep all numbers and RERA IDs verbatim.';
  }
}

export const languageDetectorService = new LanguageDetectorService();

