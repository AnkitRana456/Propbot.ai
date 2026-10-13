import { describe, it, expect } from 'vitest';
import {
  intentScorerService,
  type ScoringSignalsInput,
} from '../../src/modules/leads/intent-scorer.service.js';

describe('IntentScorerService', () => {
  it('detects high-intent signals from conversational text', () => {
    const text =
      'Hi, I would love to book a site visit this weekend for a 3BHK villa. What is the price and payment plan? I am looking to move in immediately.';
    const signals = intentScorerService.detectSignalsFromText(text);

    expect(signals.hasRequestedSiteVisit).toBe(true);
    expect(signals.hasAskedPriceOrPaymentPlan).toBe(true);
    expect(signals.hasUrgencyWords).toBe(true);
    expect(signals.hasPositiveSentiment).toBe(true);
  });

  it('detects casual or broker markers as disqualifiers', () => {
    const text = 'I am a student doing a college project on luxury real estate, just looking.';
    const signals = intentScorerService.detectSignalsFromText(text);

    expect(signals.hasBrokerOrCasualMarker).toBe(true);
  });

  it('calculates Cold score (0-34) for passive exploration', () => {
    const signals: ScoringSignalsInput = {
      messageCount: 2,
    };
    const result = intentScorerService.calculateScore(signals);

    expect(result.score).toBeLessThanOrEqual(34);
    expect(result.label).toBe('cold');
    expect(result.priority).toBe('low');
    expect(result.topReasons.length).toBeGreaterThan(0);
  });

  it('calculates Warm score (35-69) for engaged inquiries', () => {
    const signals: ScoringSignalsInput = {
      hasSharedPhone: true, // +20
      hasAskedPriceOrPaymentPlan: true, // +15
      messageCount: 5, // +5
    };
    const result = intentScorerService.calculateScore(signals);

    expect(result.score).toBe(40);
    expect(result.label).toBe('warm');
    expect(result.priority).toBe('medium');
    expect(result.topReasons).toHaveLength(3);
    expect(result.topReasons[0]).toContain('Shared verified phone (+20)');
    expect(result.topReasons[1]).toContain('Inquired about pricing & payment plan (+15)');
  });

  it('calculates Hot score (70-100) and maps to high/urgent priority', () => {
    const signals: ScoringSignalsInput = {
      hasRequestedSiteVisit: true, // +25
      hasSharedPhone: true, // +20
      hasAskedPriceOrPaymentPlan: true, // +15
      hasBudgetFitWithInventory: true, // +15
      hasUrgencyWords: true, // +15
    };
    const result = intentScorerService.calculateScore(signals);

    expect(result.score).toBe(90);
    expect(result.label).toBe('hot');
    expect(result.priority).toBe('urgent');
    // Top 3 reasons
    expect(result.topReasons).toHaveLength(3);
    expect(result.topReasons[0]).toContain('Requested site visit (+25)');
    expect(result.topReasons[1]).toContain('Shared verified phone (+20)');
  });

  it('clamps scores strictly between 0 and 100', () => {
    // Huge points exceeding 100
    const highSignals: ScoringSignalsInput = {
      hasRequestedSiteVisit: true, // 25
      hasSharedPhone: true, // 20
      hasAskedPriceOrPaymentPlan: true, // 15
      hasBudgetFitWithInventory: true, // 15
      hasUrgencyWords: true, // 15
      hasViewedShortlistRoom: true, // 15
      hasAskedPossessionDate: true, // 10
      isReturningVisitor: true, // 10
      messageCount: 15, // 10
      hasPositiveSentiment: true, // 5
      hasHighDwellTime: true, // 5
    };
    const maxResult = intentScorerService.calculateScore(highSignals);
    expect(maxResult.score).toBe(100);

    // Negative deduction greater than positive signals
    const lowSignals: ScoringSignalsInput = {
      hasBrokerOrCasualMarker: true, // -25
      messageCount: 1,
    };
    const minResult = intentScorerService.calculateScore(lowSignals);
    expect(minResult.score).toBe(0);
  });

  it('supports custom company weights and thresholds', () => {
    const customConfig = {
      thresholds: {
        coldMax: 40,
        warmMin: 41,
        warmMax: 79,
        hotMin: 80,
      },
      weights: {
        requestedSiteVisit: 40,
        sharedPhone: 40,
        askedPricePaymentPlan: 10,
        budgetFitInventory: 10,
        urgencyWords: 10,
        viewedShortlistRoom: 10,
        askedPossessionDate: 10,
        returnedToChat: 10,
        messagesDepth5: 5,
        messagesDepth10: 5,
        sentimentPositive: 5,
        timeOnPage: 5,
        brokerCasualDeduction: -30,
      },
    };

    const signals: ScoringSignalsInput = {
      hasRequestedSiteVisit: true, // 40
      hasSharedPhone: true, // 40
    };

    const result = intentScorerService.calculateScore(signals, customConfig);
    expect(result.score).toBe(80);
    expect(result.label).toBe('hot');
  });
});
