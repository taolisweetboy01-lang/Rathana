/**
 * MASTER AI ANALYSIS - 6:00 AM TRADING DAY ROLLOVER CALCULATOR
 * A trading day begins at 6:00 AM and ends at 6:00 AM the next day.
 */

export function get6AmTradingCycleStart(referenceTime: number = Date.now(), daysBack: number = 0): number {
  const d = new Date(referenceTime);
  // If current local hour is before 6 AM, current cycle began yesterday at 6:00 AM
  if (d.getHours() < 6) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(6, 0, 0, 0);

  // Subtract full 24-hour cycles for past periods
  if (daysBack > 0) {
    d.setDate(d.getDate() - daysBack);
  }
  return d.getTime();
}
