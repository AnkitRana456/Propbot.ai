export interface RoiInput {
  /** Enquiries a month across every channel. */
  enquiries: number;
  /** Percent of enquiries that get no reply or a late one today. */
  missedPct: number;
  /** Percent of answered enquiries that turn into a site visit. */
  visitPct: number;
  /** Percent of site visits that turn into a booking. */
  bookingPct: number;
  /** What one booking earns the agency, in rupees. */
  earnPerBooking: number;
}

/** What answering the missed enquiries is worth each month. */
export function roi({ enquiries, missedPct, visitPct, bookingPct, earnPerBooking }: RoiInput) {
  const recovered = (enquiries * missedPct) / 100;
  const visits = (recovered * visitPct) / 100;
  const bookings = (visits * bookingPct) / 100;
  return { recovered: Math.round(recovered), visits: Math.round(visits), bookings: Number(bookings.toFixed(1)), revenue: Math.round(bookings * earnPerBooking) };
}
