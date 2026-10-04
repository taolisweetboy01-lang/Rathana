/**
 * MASTER AI ANALYSIS - CORE MULTI-TIMEFRAME ANALYSIS ENGINE
 * Architecture: M15 (Trend) -> M5 (Setup) -> M3 (Entry)
 * Generates: BUY, SELL, or WAIT.
 */

import {
  Candle,
  DebugAuditLog,
  MarketDataProvider,
  SignalOutput,
  SignalStatus,
  SupportedSymbol,
} from "./types";
import { getSymbolConfig } from "./config";
import { RealMarketDataProvider } from "./marketData";
import { analyzeM15Trend } from "./m15Trend";
import { analyzeM5Setup } from "./m5Setup";
import { analyzeM3Entry } from "./m3Entry";
import { calculateConfidence, calculateRiskParameters } from "./riskEngine";

export interface EngineOptions {
  marketDataProvider?: MarketDataProvider;
  debug?: boolean;
  overrideCandles?: {
    m15?: Candle[];
    m5?: Candle[];
    m3?: Candle[];
  };
}

// Active Signal Memory for Deduplication & Expiration tracking
const ACTIVE_SIGNALS: Record<SupportedSymbol, SignalOutput | null> = {
  XAUUSD: null,
  BTCUSD: null,
};

/**
 * Main Analysis Entry Point
 */
export async function runMultiTimeframeEngine(
  symbol: SupportedSymbol,
  options: EngineOptions = {}
): Promise<SignalOutput> {
  const config = getSymbolConfig(symbol);
  const dataProvider = options.marketDataProvider || new RealMarketDataProvider();
  const now = Date.now();

  // 1. Fetch Real M15, M5, and M3 Market Data
  let m15Candles = options.overrideCandles?.m15 || null;
  let m5Candles = options.overrideCandles?.m5 || null;
  let m3Candles = options.overrideCandles?.m3 || null;

  if (!m15Candles || !m5Candles || !m3Candles) {
    try {
      const [f15, f5, f3] = await Promise.all([
        dataProvider.getMarketData(symbol, "M15", 50),
        dataProvider.getMarketData(symbol, "M5", 50),
        dataProvider.getMarketData(symbol, "M3", 50),
      ]);
      m15Candles = m15Candles || f15;
      m5Candles = m5Candles || f5;
      m3Candles = m3Candles || f3;
    } catch (e) {
      // Data provider network error
    }
  }

  // Data Integrity & Freshness Gate
  if (!m15Candles || !m5Candles || !m3Candles) {
    return makeWaitSignal(
      symbol,
      "UNCLEAR",
      "DATA_FEED_PENDING",
      "Waiting for fresh M15, M5, and M3 market data feed from provider",
      now,
      options.debug
    );
  }

  const currentPrice = m3Candles[m3Candles.length - 1].close;

  // 2. M15 Trend Engine
  const m15Analysis = analyzeM15Trend(m15Candles, config);

  // Filter: If M15 is SIDEWAYS or UNCLEAR -> WAIT (Never force trade)
  if (m15Analysis.trend === "SIDEWAYS" || m15Analysis.trend === "UNCLEAR") {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      "NO_TREND",
      m15Analysis.reason,
      now,
      options.debug,
      {
        m15: {
          trend: m15Analysis.trend,
          reason: m15Analysis.reason,
          swingsFound: m15Analysis.swings.length,
        },
      }
    );
  }

  // 3. M5 Setup Engine
  const m5Analysis = analyzeM5Setup(m5Candles, m15Analysis, config);

  if (!m5Analysis.isValid) {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      m5Analysis.type,
      `M15 is ${m15Analysis.trend}, but ${m5Analysis.reason}`,
      now,
      options.debug,
      {
        m15: {
          trend: m15Analysis.trend,
          reason: m15Analysis.reason,
          swingsFound: m15Analysis.swings.length,
        },
        m5: {
          setupType: m5Analysis.type,
          isValid: m5Analysis.isValid,
          reason: m5Analysis.reason,
          breakoutLevel: m5Analysis.breakoutLevel,
        },
      }
    );
  }

  // 4. M3 Entry Engine
  const m3Analysis = analyzeM3Entry(m3Candles, m5Analysis, m15Analysis, config);

  if (!m3Analysis.isConfirmed || !m3Analysis.entryPrice) {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      m5Analysis.type,
      `Valid M5 setup ready, but ${m3Analysis.reason}`,
      now,
      options.debug,
      {
        m15: {
          trend: m15Analysis.trend,
          reason: m15Analysis.reason,
          swingsFound: m15Analysis.swings.length,
        },
        m5: {
          setupType: m5Analysis.type,
          isValid: m5Analysis.isValid,
          reason: m5Analysis.reason,
          breakoutLevel: m5Analysis.breakoutLevel,
        },
        m3: {
          isConfirmed: m3Analysis.isConfirmed,
          reason: m3Analysis.reason,
          entryPrice: m3Analysis.entryPrice,
        },
      }
    );
  }

  // 5. Structure-Based Risk & Reward Calculation
  const side: "BUY" | "SELL" = m15Analysis.trend === "BULLISH" ? "BUY" : "SELL";
  const anchor =
    side === "BUY"
      ? m3Analysis.structuralAnchorLow
      : m3Analysis.structuralAnchorHigh;

  if (anchor === null) {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      m5Analysis.type,
      "Cannot determine verified structural anchor for Stop Loss",
      now,
      options.debug
    );
  }

  const risk = calculateRiskParameters(
    side,
    m3Analysis.entryPrice,
    anchor,
    m15Candles,
    m5Candles,
    config
  );

  // Maximum / Minimum SL Filter Check
  if (!risk.isSlValid) {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      m5Analysis.type,
      `Trade rejected: ${risk.slValidationReason}`,
      now,
      options.debug
    );
  }

  // Support / Resistance Obstacle Filter Check
  if (!risk.srClearanceValid) {
    return makeWaitSignal(
      symbol,
      m15Analysis.trend,
      m5Analysis.type,
      `Trade rejected: ${risk.srValidationReason}`,
      now,
      options.debug
    );
  }

  // 6. Transparent Confidence Score
  const confidence = calculateConfidence(
    m15Analysis.trend === "BULLISH" || m15Analysis.trend === "BEARISH",
    m5Analysis.isValid,
    m3Analysis.momentumStrength,
    risk.srClearanceValid,
    true
  );

  // 7. Deduplication & Unique Signal ID
  const entryCandleTime = m3Analysis.triggerCandle?.time || now;
  const signalId = `sig_${symbol}_${side}_${Math.floor(entryCandleTime / 180000)}_${Math.round(risk.stopLoss)}`;

  // Construct Final Signal
  const finalReason = `${m15Analysis.trend} M15 trend + ${m5Analysis.type} on M5 + M3 confirmation (${m3Analysis.reason}). Target TP1 (1R) and TP2 (2R).`;

  const debugLog: DebugAuditLog | undefined = options.debug
    ? {
        timestamp: new Date().toISOString(),
        symbol,
        m15: {
          trend: m15Analysis.trend,
          reason: m15Analysis.reason,
          swingsFound: m15Analysis.swings.length,
        },
        m5: {
          setupType: m5Analysis.type,
          isValid: m5Analysis.isValid,
          reason: m5Analysis.reason,
          breakoutLevel: m5Analysis.breakoutLevel,
        },
        m3: {
          isConfirmed: m3Analysis.isConfirmed,
          reason: m3Analysis.reason,
          entryPrice: m3Analysis.entryPrice,
        },
        risk: {
          entry: risk.entry,
          stopLoss: risk.stopLoss,
          tp1: risk.tp1,
          tp2: risk.tp2,
          riskDistance: risk.riskDistance,
          riskReward: risk.riskReward,
          isSlValid: risk.isSlValid,
          srClearanceValid: risk.srClearanceValid,
        },
        confidence,
        finalDecision: side,
      }
    : undefined;

  const output: SignalOutput = {
    symbol,
    status: side,
    trend: m15Analysis.trend,
    setup: m5Analysis.type,
    entry: risk.entry,
    stopLoss: risk.stopLoss,
    tp1: risk.tp1,
    tp2: risk.tp2,
    riskReward: risk.riskReward,
    riskDistance: risk.riskDistance,
    confidenceScore: confidence.totalScore,
    confidenceBreakdown: confidence,
    reason: finalReason,
    timestamp: now,
    signalId,
    debug: debugLog,
  };

  ACTIVE_SIGNALS[symbol] = output;
  return output;
}

/**
 * Constructs a structured WAIT signal
 */
function makeWaitSignal(
  symbol: SupportedSymbol,
  trend: any,
  setup: string,
  reason: string,
  timestamp: number,
  debugEnabled: boolean = false,
  partialAudit: Partial<DebugAuditLog> = {}
): SignalOutput {
  const debugLog: DebugAuditLog | undefined = debugEnabled
    ? {
        timestamp: new Date().toISOString(),
        symbol,
        m15: partialAudit.m15 || { trend, reason, swingsFound: 0 },
        m5: partialAudit.m5 || { setupType: setup, isValid: false, reason, breakoutLevel: null },
        m3: partialAudit.m3 || { isConfirmed: false, reason, entryPrice: null },
        risk: {
          entry: null,
          stopLoss: null,
          tp1: null,
          tp2: null,
          riskDistance: null,
          riskReward: null,
          isSlValid: false,
          srClearanceValid: false,
        },
        confidence: {
          m15TrendScore: 0,
          m5SetupScore: 0,
          m3EntryScore: 0,
          targetClearanceScore: 0,
          riskRewardScore: 0,
          totalScore: 0,
        },
        finalDecision: "WAIT",
        waitReason: reason,
      }
    : undefined;

  return {
    symbol,
    status: "WAIT",
    trend,
    setup,
    entry: null,
    stopLoss: null,
    tp1: null,
    tp2: null,
    riskReward: null,
    riskDistance: null,
    confidenceScore: 0,
    reason,
    timestamp,
    signalId: `wait_${symbol}_${Math.floor(timestamp / 60000)}`,
    debug: debugLog,
  };
}
