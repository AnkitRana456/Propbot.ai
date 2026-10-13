import { describe, it, expect } from 'vitest';
import { languageDetectorService } from '../../src/modules/ai/language-detector.service.js';

describe('Multilingual Language Detector Service', () => {
  it('correctly detects English text', () => {
    const res = languageDetectorService.detectLanguage('What is the starting price for 3BHK luxury residences?');
    expect(res.code).toBe('en');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('correctly detects Hindi written in Devanagari script', () => {
    const res = languageDetectorService.detectLanguage('3BHK विला की शुरुआती कीमत क्या है और क्या पेमेंट प्लान उपलब्ध है?');
    expect(res.code).toBe('hi');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('correctly detects Hinglish (Hindi written in Latin script)', () => {
    const res = languageDetectorService.detectLanguage('Kya 3BHK residences ka payment plan available hai? Please brochure bhejo.');
    expect(res.code).toBe('hi-Latn');
    expect(res.confidence).toBeGreaterThan(0.6);
  });

  it('correctly detects Marathi text in Devanagari script', () => {
    const res = languageDetectorService.detectLanguage('प्रकल्पामध्ये ३ बीएचके फ्लॅट उपलब्ध आहेत का? कृपया माहिती सांगा.');
    expect(res.code).toBe('mr');
  });

  it('correctly detects Tamil text', () => {
    const res = languageDetectorService.detectLanguage('இந்த திட்டத்தில் 3BHK அடுக்குமாடி குடியிருப்புகள் உள்ளனவா?');
    expect(res.code).toBe('ta');
  });

  it('correctly detects Telugu text', () => {
    const res = languageDetectorService.detectLanguage('ఈ ప్రాజెక్ట్‌లో 3BHK విల్లాలు అందుబాటులో ఉన్నాయా?');
    expect(res.code).toBe('te');
  });

  it('correctly detects Kannada text', () => {
    const res = languageDetectorService.detectLanguage('ಈ ಯೋಜನೆಯಲ್ಲಿ 3BHK ವಿಲ್ಲಾಗಳು ಲಭ್ಯವಿವೆಯೇ?');
    expect(res.code).toBe('kn');
  });

  it('correctly detects Bengali text', () => {
    const res = languageDetectorService.detectLanguage('এই প্রকল্পে কি 3BHK ভিলা পাওয়া যাবে?');
    expect(res.code).toBe('bn');
  });

  it('correctly detects Gujarati text', () => {
    const res = languageDetectorService.detectLanguage('આ પ્રોજેક્ટમાં 3BHK વિલા ઉપલબ્ધ છે કે નહીં?');
    expect(res.code).toBe('gu');
  });

  it('correctly detects Arabic text', () => {
    const res = languageDetectorService.detectLanguage('ما هي الأسعار المتاحة لفيلات 3 غرف نوم؟');
    expect(res.code).toBe('ar');
    expect(res.isRtl).toBe(true);
  });

  it('generates prompt instruction directive respecting allowed chatbot languages', () => {
    const hindiDirective = languageDetectorService.getLanguageDirective('hi', ['en', 'hi']);
    expect(hindiDirective).toContain('Hindi');
    expect(hindiDirective).toContain('RERA IDs');

    const hinglishDirective = languageDetectorService.getLanguageDirective('hi-Latn', ['en', 'hi-Latn']);
    expect(hinglishDirective).toContain('Hinglish');

    // If detected language is not allowed, falls back to English directive
    const fallbackDirective = languageDetectorService.getLanguageDirective('ar', ['en', 'hi']);
    expect(fallbackDirective).toContain('English');
  });
});
