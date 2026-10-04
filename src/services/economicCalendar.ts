/**
 * Economic News & ForexFactory Calendar Radar
 * Alerts clients of upcoming High-Impact USD news (Red Folders)
 * Displays Actual, Forecast, Previous with Green (Good for USD) / Red (Bad for USD).
 */

export interface EconomicEvent {
  id: string;
  currency: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  timeLocal: string; // e.g. "19:30 (Cambodia Time)"
  actual?: string;
  forecast: string;
  previous: string;
  status: "RELEASED" | "UPCOMING";
  usdImpact: "BULLISH_USD" | "BEARISH_USD" | "PENDING";
  dateStr: string;
  isToday: boolean;
  isHappeningNow: boolean;
  affectedPairs: string[];
  riskAdvice: string;
}

export const UPCOMING_HIGH_IMPACT_NEWS: EconomicEvent[] = [
  {
    id: "news-cpi",
    currency: "USD",
    impact: "HIGH",
    title: "US Core CPI (Consumer Price Index) m/m",
    timeLocal: "19:30 (Cambodia Time)",
    actual: "0.4%", // Actual > Forecast (Green for USD)
    forecast: "0.3%",
    previous: "0.3%",
    status: "RELEASED",
    usdImpact: "BULLISH_USD",
    dateStr: "Today / Just Released",
    isToday: true,
    isHappeningNow: true,
    affectedPairs: ["XAUUSD", "BTCUSD", "EURUSD"],
    riskAdvice: "Actual (0.4%) > Forecast (0.3%) ពណ៌បៃតងល្អសម្រាប់ USD (មាសអាចរងសម្ពាធធ្លាក់ចុះ)។ Signal នៅតែដំណើរការធម្មតា។",
  },
  {
    id: "news-nfp",
    currency: "USD",
    impact: "HIGH",
    title: "Non-Farm Employment Change (NFP)",
    timeLocal: "19:30 (Cambodia Time)",
    actual: "135K", // Actual < Forecast (Red for USD)
    forecast: "165K",
    previous: "142K",
    status: "RELEASED",
    usdImpact: "BEARISH_USD",
    dateStr: "Recent Event",
    isToday: true,
    isHappeningNow: false,
    affectedPairs: ["XAUUSD", "BTCUSD"],
    riskAdvice: "Actual (135K) < Forecast (165K) ពណ៌ក្រហមអវិជ្ជមានសម្រាប់ USD (ជំរុញឱ្យតម្លៃមាសស្ទុះឡើង)។",
  },
  {
    id: "news-fomc",
    currency: "USD",
    impact: "HIGH",
    title: "FOMC Rate Decision & Fed Chair Powell Conference",
    timeLocal: "01:30 AM (Midnight)",
    actual: undefined,
    forecast: "4.75%",
    previous: "5.00%",
    status: "UPCOMING",
    usdImpact: "PENDING",
    dateStr: "Upcoming Tonight",
    isToday: true,
    isHappeningNow: false,
    affectedPairs: ["XAUUSD", "BTCUSD"],
    riskAdvice: "កិច្ចប្រជុំការប្រាក់ Fed: បង្កើន Volatility ខ្ពស់បំផុត។ ណែនាំបន្ថយ Lot Size ឬរង់ចាំទៀន M5 បិទសិន។",
  },
  {
    id: "news-ppi",
    currency: "USD",
    impact: "HIGH",
    title: "Core PPI (Producer Price Index) m/m",
    timeLocal: "19:30 (Cambodia Time)",
    actual: undefined,
    forecast: "0.2%",
    previous: "0.2%",
    status: "UPCOMING",
    usdImpact: "PENDING",
    dateStr: "Tomorrow",
    isToday: false,
    isHappeningNow: false,
    affectedPairs: ["XAUUSD"],
    riskAdvice: "រង្វាស់អតិផរណាថ្លៃដើមផលិតកម្ម ជះឥទ្ធិពលលើតម្លៃមាស Spot Gold។",
  },
  {
    id: "news-claims",
    currency: "USD",
    impact: "MEDIUM",
    title: "Unemployment Claims (Weekly Jobless)",
    timeLocal: "19:30 (Cambodia Time)",
    actual: "215K",
    forecast: "220K",
    previous: "224K",
    status: "RELEASED",
    usdImpact: "BULLISH_USD",
    dateStr: "Every Thursday",
    isToday: false,
    isHappeningNow: false,
    affectedPairs: ["XAUUSD"],
    riskAdvice: "Jobless Claims ថយចុះ (ល្អសម្រាប់ USD) អាចបង្កើនល្បឿននៃការ Breakout M5។",
  },
];

export function getActiveNewsStatus() {
  const currentEvent =
    UPCOMING_HIGH_IMPACT_NEWS.find((e) => e.isHappeningNow) || UPCOMING_HIGH_IMPACT_NEWS[0];
  return {
    hasActiveNews: true,
    currentEvent,
    allEvents: UPCOMING_HIGH_IMPACT_NEWS,
  };
}

