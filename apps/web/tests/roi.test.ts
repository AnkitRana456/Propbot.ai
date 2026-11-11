import { describe, it, expect } from 'vitest';
import { roi } from '../src/components/marketing/roi.js';

describe('roi', () => {
  it('walks missed enquiries down the funnel to revenue', () => {
    expect(roi({ enquiries: 400, missedPct: 50, visitPct: 20, bookingPct: 10, earnPerBooking: 200_000 })).toEqual({ recovered: 200, visits: 40, bookings: 4, revenue: 800_000 });
  });

  it('is zero when nothing is missed', () => {
    expect(roi({ enquiries: 400, missedPct: 0, visitPct: 20, bookingPct: 10, earnPerBooking: 200_000 }).revenue).toBe(0);
  });
});
