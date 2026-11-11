import { describe, expect, it } from 'vitest';
import { parseSourceTag } from '../../src/modules/ai/retrieval.service.js';

describe('parseSourceTag', () => {
  it('strips the report and reads source numbers', () => {
    expect(parseSourceTag('3 BHK starts at Rs 1.85 Crore.\n[SOURCES: 1,3]')).toEqual({ answer: '3 BHK starts at Rs 1.85 Crore.', sources: [1, 3] });
  });
  it('treats none as a miss', () => {
    expect(parseSourceTag('I do not have that.\n[SOURCES: none]')).toEqual({ answer: 'I do not have that.', sources: [] });
  });
  it('keeps a greeting grounded through source 0', () => {
    expect(parseSourceTag('Hello!\n[sources: 0]').sources).toEqual([0]);
  });
  it('returns null when the model left the report out', () => {
    expect(parseSourceTag('Plain reply [not a tag] here.')).toEqual({ answer: 'Plain reply [not a tag] here.', sources: null });
  });
});
