import type { IntentLabel, LeadPriority, ScoringConfig } from '@propbot/shared';

export interface ScoringSignalsInput {
  hasRequestedSiteVisit?: boolean;
  hasSharedPhone?: boolean;
  hasAskedPriceOrPaymentPlan?: boolean;
  hasBudgetFitWithInventory?: boolean;
  hasUrgencyWords?: boolean;
  hasViewedShortlistRoom?: boolean;
  hasAskedPossessionDate?: boolean;
  isReturningVisitor?: boolean;
  messageCount?: number;
  hasPositiveSentiment?: boolean;
  hasHighDwellTime?: boolean; // > 3 minutes
  hasBrokerOrCasualMarker?: boolean;
}

export interface IntentScoreResult {
  score: number;
  label: IntentLabel;
  priority: LeadPriority;
  topReasons: string[];
  signalBreakdown: Record<string, number>;
}

export class IntentScorerService {
  /**
   * Evaluates text context to detect scoring signals from messages.
   */
  detectSignalsFromText(
    userMessage: string,
    existingSignals: ScoringSignalsInput = {},
  ): ScoringSignalsInput {
    const text = userMessage.toLowerCase();
    const signals: ScoringSignalsInput = { ...existingSignals };

    // 1. Requested site visit
    if (
      text.includes('site visit') ||
      text.includes('book a visit') ||
      text.includes('schedule a visit') ||
      text.includes('visit this weekend') ||
      text.includes('come to the property') ||
      text.includes('book appointment')
    ) {
      signals.hasRequestedSiteVisit = true;
    }

    // 2. Asked price / payment plan
    if (
      text.includes('price') ||
      text.includes('cost') ||
      text.includes('payment plan') ||
      text.includes('payment schedule') ||
      text.includes('discount') ||
      text.includes('emi') ||
      text.includes('how much')
    ) {
      signals.hasAskedPriceOrPaymentPlan = true;
    }

    // 3. Asked possession date
    if (
      text.includes('possession') ||
      text.includes('handover') ||
      text.includes('completion date') ||
      text.includes('when can i move in') ||
      text.includes('delivery date')
    ) {
      signals.hasAskedPossessionDate = true;
    }

    // 4. Urgency words
    if (
      text.includes('ready to move') ||
      text.includes('immediately') ||
      text.includes('immediate') ||
      text.includes('urgent') ||
      text.includes('this week') ||
      text.includes('this month') ||
      text.includes('looking to finalize')
    ) {
      signals.hasUrgencyWords = true;
    }

    // 5. Shared phone (digits or phone indicators)
    if (
      text.match(/(?:\+?91|0)?[6-9]\d{9}/) ||
      text.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/)
    ) {
      signals.hasSharedPhone = true;
    }

    // 6. Positive sentiment
    if (
      text.includes('love') ||
      text.includes('great') ||
      text.includes('interested') ||
      text.includes('perfect') ||
      text.includes('excellent') ||
      text.includes('looks good')
    ) {
      signals.hasPositiveSentiment = true;
    }

    // 7. Broker or casual disqualifier
    if (
      text.includes('just looking') ||
      text.includes('student project') ||
      text.includes('college project') ||
      text.includes('i am an agent') ||
      text.includes('real estate broker')
    ) {
      signals.hasBrokerOrCasualMarker = true;
    }

    return signals;
  }

  /**
   * Calculates the Live Intent Score (0–100) using the 11 transparent signals
   * and generates explainable top reasons.
   */
  calculateScore(
    signals: ScoringSignalsInput,
    config?: Partial<ScoringConfig>,
  ): IntentScoreResult {
    const weights = config?.weights ?? {
      requestedSiteVisit: 25,
      sharedPhone: 20,
      askedPricePaymentPlan: 15,
      budgetFitInventory: 15,
      urgencyWords: 15,
      viewedShortlistRoom: 15,
      askedPossessionDate: 10,
      returnedToChat: 10,
      messagesDepth5: 5,
      messagesDepth10: 5,
      sentimentPositive: 5,
      timeOnPage: 5,
      brokerCasualDeduction: -25,
    };

    const thresholds = config?.thresholds ?? {
      coldMax: 34,
      warmMin: 35,
      warmMax: 69,
      hotMin: 70,
    };

    const breakdown: Record<string, { points: number; label: string }> = {};

    // 1. Site visit
    if (signals.hasRequestedSiteVisit) {
      breakdown['requested_site_visit'] = {
        points: weights.requestedSiteVisit,
        label: `Requested site visit (+${weights.requestedSiteVisit})`,
      };
    }

    // 2. Shared phone
    if (signals.hasSharedPhone) {
      breakdown['shared_phone'] = {
        points: weights.sharedPhone,
        label: `Shared verified phone (+${weights.sharedPhone})`,
      };
    }

    // 3. Price / payment plan
    if (signals.hasAskedPriceOrPaymentPlan) {
      breakdown['asked_price_payment_plan'] = {
        points: weights.askedPricePaymentPlan,
        label: `Inquired about pricing & payment plan (+${weights.askedPricePaymentPlan})`,
      };
    }

    // 4. Budget fit
    if (signals.hasBudgetFitWithInventory) {
      breakdown['budget_fit_inventory'] = {
        points: weights.budgetFitInventory,
        label: `Budget fits project inventory (+${weights.budgetFitInventory})`,
      };
    }

    // 5. Urgency words
    if (signals.hasUrgencyWords) {
      breakdown['urgency_words'] = {
        points: weights.urgencyWords,
        label: `Stated high purchase urgency (+${weights.urgencyWords})`,
      };
    }

    // 6. Viewed shortlist room
    if (signals.hasViewedShortlistRoom) {
      breakdown['viewed_shortlist_room'] = {
        points: weights.viewedShortlistRoom,
        label: `Viewed Smart Shortlist Room (+${weights.viewedShortlistRoom})`,
      };
    }

    // 7. Asked possession date
    if (signals.hasAskedPossessionDate) {
      breakdown['asked_possession_date'] = {
        points: weights.askedPossessionDate,
        label: `Inquired about possession date (+${weights.askedPossessionDate})`,
      };
    }

    // 8. Returning visitor
    if (signals.isReturningVisitor) {
      breakdown['returned_to_chat'] = {
        points: weights.returnedToChat,
        label: `Resumed active conversation (+${weights.returnedToChat})`,
      };
    }

    // 9. Messages depth
    const msgCount = signals.messageCount ?? 1;
    if (msgCount >= 10) {
      const combined = weights.messagesDepth5 + weights.messagesDepth10;
      breakdown['message_depth'] = {
        points: combined,
        label: `Deep engagement (${msgCount} messages) (+${combined})`,
      };
    } else if (msgCount >= 5) {
      breakdown['message_depth'] = {
        points: weights.messagesDepth5,
        label: `Active engagement (${msgCount} messages) (+${weights.messagesDepth5})`,
      };
    }

    // 10. Sentiment
    if (signals.hasPositiveSentiment) {
      breakdown['sentiment_positive'] = {
        points: weights.sentimentPositive,
        label: `Positive buying sentiment (+${weights.sentimentPositive})`,
      };
    }

    // 11. Dwell time
    if (signals.hasHighDwellTime) {
      breakdown['time_on_page'] = {
        points: weights.timeOnPage,
        label: `High dwell time on project (+${weights.timeOnPage})`,
      };
    }

    // Negative / Casual marker
    if (signals.hasBrokerOrCasualMarker) {
      breakdown['broker_casual'] = {
        points: weights.brokerCasualDeduction,
        label: `Casual browsing / broker inquiry (${weights.brokerCasualDeduction})`,
      };
    }

    // Calculate raw sum
    const totalRaw = Object.values(breakdown).reduce((acc, curr) => acc + curr.points, 0);

    // Clamp score 0 - 100
    const finalScore = Math.max(0, Math.min(100, Math.round(totalRaw)));

    // Categorize
    let label: IntentLabel = 'cold';
    let priority: LeadPriority = 'low';

    if (finalScore >= thresholds.hotMin) {
      label = 'hot';
      priority = finalScore >= 85 ? 'urgent' : 'high';
    } else if (finalScore >= thresholds.warmMin) {
      label = 'warm';
      priority = 'medium';
    } else {
      label = 'cold';
      priority = 'low';
    }

    // Top 3 reasons
    const topReasons = Object.values(breakdown)
      .filter(item => item.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map(item => item.label);

    // If no positive reasons yet, provide informative starting state
    if (topReasons.length === 0) {
      topReasons.push('Initial exploration in progress');
    }

    const signalPoints: Record<string, number> = {};
    for (const [key, val] of Object.entries(breakdown)) {
      signalPoints[key] = val.points;
    }

    return {
      score: finalScore,
      label,
      priority,
      topReasons,
      signalBreakdown: signalPoints,
    };
  }
}

export const intentScorerService = new IntentScorerService();
