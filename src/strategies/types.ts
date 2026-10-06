/**
 * Core Strategy Interfaces and Types
 * Modular Trading Architecture for Master AI
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface StrategyDiagnostic {
  title: string;
  status: string;
  statusColor?: string;
  description: string;
}

export interface StrategyEvaluationResult {
  symbol: string;
  side: "BUY" | "SELL" | "WAIT";
  status: "ACTIVE" | "WAIT";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  riskReward: string;
  riskDistance: number;
  confidenceScore: number;
  reason: string;
  details?: Record<string, any>;
  diagnostics?: StrategyDiagnostic[];
}

export interface TradingStrategy {
  id: string;
  number: "01" | "02" | "03"; // Sequential Numbering Display
  name: string;
  shortName: string;
  category: string;
  timeframe: string;
  timeframes: string[];
  description: string;
  soundEnabled: boolean; // Per-strategy Sound Alert toggle state
  winRate: string;
  profitFactor?: string;
  tradesCount?: string;
  netRR?: string;
  maxDrawdown?: string;
  defaultRR: string;
  rules: {
    entryRule: string;
    slRule: string;
    tpRule: string;
  };
  evaluate: (
    market: string,
    klines: Candle[],
    currentPrice: number | null
  ) => StrategyEvaluationResult;
}

/**
 * Helper to generate synthetic realistic candles if API feed is still warming up
 */
export function generateSyntheticCandles(
  market: string,
  currentPrice: number,
  count = 30
): Candle[] {
  const isGold = market === "XAUUSD";
  const step = isGold ? 0.45 : 40.0;
  const now = Date.now();
  const candles: Candle[] = [];
  let price = currentPrice - step * 5;

  for (let i = 0; i < count; i++) {
    const delta = (Math.sin(i * 0.5) + (i > count - 4 ? 0.6 : 0.1)) * step;
    const open = price;
    price += delta;
    const close = price;
    const high = Math.max(open, close) + step * 0.4;
    const low = Math.min(open, close) - step * 0.4;
    candles.push({
      time: now - (count - i) * 60000,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: 120 + i * 5,
    });
  }
  return candles;
}
