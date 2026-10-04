/**
 * MASTER AI ANALYSIS - ENGINE TYPES
 * Multi-Timeframe Architecture: M15 (Trend) -> M5 (Setup) -> M3 (Entry)
 */

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SupportedSymbol = "XAUUSD" | "BTCUSD";
export type Timeframe = "M15" | "M5" | "M3";
export type TrendDirection = "BULLISH" | "BEARISH" | "SIDEWAYS" | "UNCLEAR";
export type SignalStatus = "BUY" | "SELL" | "WAIT";

export interface SymbolConfig {
  symbol: SupportedSymbol;
  feedSymbol: string;
  pipSize: number;
  pointMultiplier: number;
  slBufferPips: number;
  minSlDistance: number;
  maxSlDistance: number;
  minRiskReward: number; // e.g. 1.5
  swingLookback: number;
  confirmationCandles: number;
  maxSignalAgeMinutes: number;
}

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: "HIGH" | "LOW";
  isConfirmed: boolean;
}

export interface M15TrendAnalysis {
  trend: TrendDirection;
  reason: string;
  swings: SwingPoint[];
  recentHigh: number | null;
  recentLow: number | null;
  higherHighCount: number;
  lowerLowCount: number;
  bosDetected: boolean;
  bosLevel: number | null;
}

export interface M5SetupAnalysis {
  isValid: boolean;
  type: "VALID_BULLISH_RETEST" | "VALID_BEARISH_RETEST" | "NO_VALID_M5_SETUP";
  reason: string;
  breakoutLevel: number | null;
  retestZoneLow: number | null;
  retestZoneHigh: number | null;
  structuralSwingPoint: SwingPoint | null;
}

export interface M3EntryAnalysis {
  isConfirmed: boolean;
  reason: string;
  entryPrice: number | null;
  triggerCandle: Candle | null;
  structuralAnchorLow: number | null;
  structuralAnchorHigh: number | null;
  momentumStrength: number; // 0 to 1
}

export interface RiskAnalysis {
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  riskDistance: number;
  riskReward: string;
  isSlValid: boolean;
  slValidationReason: string;
  srClearanceValid: boolean;
  srValidationReason: string;
}

export interface ConfidenceBreakdown {
  m15TrendScore: number;       // Max 25
  m5SetupScore: number;        // Max 25
  m3EntryScore: number;        // Max 20
  targetClearanceScore: number;// Max 15
  riskRewardScore: number;     // Max 15
  totalScore: number;          // Max 100
}

export interface DebugAuditLog {
  timestamp: string;
  symbol: SupportedSymbol;
  m15: {
    trend: TrendDirection;
    reason: string;
    swingsFound: number;
  };
  m5: {
    setupType: string;
    isValid: boolean;
    reason: string;
    breakoutLevel: number | null;
  };
  m3: {
    isConfirmed: boolean;
    reason: string;
    entryPrice: number | null;
  };
  risk: {
    entry: number | null;
    stopLoss: number | null;
    tp1: number | null;
    tp2: number | null;
    riskDistance: number | null;
    riskReward: string | null;
    isSlValid: boolean;
    srClearanceValid: boolean;
  };
  confidence: ConfidenceBreakdown;
  finalDecision: SignalStatus;
  waitReason?: string;
}

export interface SignalOutput {
  symbol: SupportedSymbol;
  status: SignalStatus;
  trend: TrendDirection;
  setup: string;
  entry: number | null;
  stopLoss: number | null;
  tp1: number | null;
  tp2: number | null;
  riskReward: string | null;
  riskDistance: number | null;
  confidenceScore: number;
  confidenceBreakdown?: ConfidenceBreakdown;
  reason: string;
  timestamp: number;
  signalId: string;
  debug?: DebugAuditLog;
}

export interface MarketDataProvider {
  getMarketData(symbol: SupportedSymbol, timeframe: Timeframe, limit?: number): Promise<Candle[] | null>;
}
