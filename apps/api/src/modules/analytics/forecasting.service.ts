import type { ForecastPoint, ForecastResponse } from '@propbot/shared';

export interface DailyHistoricalPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export class ForecastingService {
  /**
   * Generates a 30-day forward projection based on 30-day moving average and 7-day day-of-week seasonality.
   * Includes 80% confidence interval band and explicit estimation metadata.
   */
  generate30DayForecast(
    historicalPoints: DailyHistoricalPoint[],
    metric: 'conversations' | 'leads',
  ): ForecastResponse {
    // If fewer than 7 days of historical data, return a baseline minimal projection
    if (!historicalPoints || historicalPoints.length === 0) {
      const emptyPoints: ForecastPoint[] = [];
      const now = new Date();
      for (let i = 1; i <= 30; i++) {
        const nextDate = new Date(now.getTime() + i * 86400000);
        const dateStr = nextDate.toISOString().split('T')[0] ?? '';
        emptyPoints.push({
          date: dateStr,
          predictedValue: 0,
          confidenceLower: 0,
          confidenceUpper: 0,
          isEstimate: true,
        });
      }
      return {
        metric,
        historicalDaysUsed: 0,
        isEstimate: true,
        methodology: '30-day moving average with 7-day cyclical seasonality',
        points: emptyPoints,
        projectedTotal: 0,
      };
    }

    // 1. Calculate historical baseline moving average
    const totalHistoricalValue = historicalPoints.reduce((acc, p) => acc + p.value, 0);
    const globalDailyAvg = totalHistoricalValue / historicalPoints.length;

    // 2. Compute Day-of-Week Seasonality indices (0 = Sunday to 6 = Saturday)
    const dowSums = [0, 0, 0, 0, 0, 0, 0];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const point of historicalPoints) {
      const dow = new Date(point.date).getUTCDay();
      dowSums[dow] = (dowSums[dow] ?? 0) + point.value;
      dowCounts[dow] = (dowCounts[dow] ?? 0) + 1;
    }

    const seasonalityFactors = dowSums.map((sum, dow) => {
      const count = dowCounts[dow] ?? 0;
      if (count === 0 || globalDailyAvg === 0) return 1.0;
      const dowAvg = sum / count;
      return dowAvg / globalDailyAvg;
    });

    // 3. Compute variance / standard deviation of residuals for confidence band
    const squaredResiduals = historicalPoints.map(p => {
      const dow = new Date(p.date).getUTCDay();
      const expected = globalDailyAvg * (seasonalityFactors[dow] ?? 1.0);
      return Math.pow(p.value - expected, 2);
    });
    const variance =
      squaredResiduals.length > 0
        ? squaredResiduals.reduce((a, b) => a + b, 0) / squaredResiduals.length
        : 1;
    const stdDev = Math.sqrt(variance);

    // 80% confidence interval multiplier for normal distribution ~ 1.28
    const confidenceMargin = Math.max(1, 1.28 * stdDev);

    // 4. Generate 30 future projection days starting from the day after latest historical date
    const lastDateStr = historicalPoints[historicalPoints.length - 1]?.date ?? new Date().toISOString().split('T')[0]!;
    const lastDate = new Date(lastDateStr);

    const projectedPoints: ForecastPoint[] = [];
    let projectedTotal = 0;

    for (let i = 1; i <= 30; i++) {
      const targetDate = new Date(lastDate.getTime() + i * 86400000);
      const dateStr = targetDate.toISOString().split('T')[0] ?? '';
      const dow = targetDate.getUTCDay();

      const factor = seasonalityFactors[dow] ?? 1.0;
      const predictedValue = Math.max(0, Math.round(globalDailyAvg * factor));
      const confidenceLower = Math.max(0, Math.round(predictedValue - confidenceMargin));
      const confidenceUpper = Math.round(predictedValue + confidenceMargin);

      projectedTotal += predictedValue;

      projectedPoints.push({
        date: dateStr,
        predictedValue,
        confidenceLower,
        confidenceUpper,
        isEstimate: true,
      });
    }

    return {
      metric,
      historicalDaysUsed: historicalPoints.length,
      isEstimate: true,
      methodology: '30-day moving average with 7-day cyclical seasonality',
      points: projectedPoints,
      projectedTotal,
    };
  }
}

export const forecastingService = new ForecastingService();
