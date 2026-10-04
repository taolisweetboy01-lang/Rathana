/**
 * MASTER AI ANALYSIS - M3 ENTRY ENGINE (OPTIMIZED FOR SCALPING)
 * M3 is the primary entry timeframe.
 * Triggers prompt scalping confirmation using closed & developing candle momentum.
 */

import { Candle, M3EntryAnalysis, M5SetupAnalysis, M15TrendAnalysis, SymbolConfig } from "./types";
import { detectStructuralSwings } from "./swingDetector";

export function analyzeM3Entry(
  candles: Candle[],
  m5Setup: M5SetupAnalysis,
  m15Trend: M15TrendAnalysis,
  config: SymbolConfig
): M3EntryAnalysis {
  if (!candles || candles.length < 15) {
    return {
      isConfirmed: false,
      reason: "Insufficient M3 candle history",
      entryPrice: null,
      triggerCandle: null,
      structuralAnchorLow: null,
      structuralAnchorHigh: null,
      momentumStrength: 0,
    };
  }

  // Pre-requisites
  if (!m5Setup.isValid) {
    return {
      isConfirmed: false,
      reason: `M3 Entry waiting for valid M5 setup (${m5Setup.reason})`,
      entryPrice: null,
      triggerCandle: null,
      structuralAnchorLow: null,
      structuralAnchorHigh: null,
      momentumStrength: 0,
    };
  }

  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3] || prev;

  const minMove = config.symbol === "XAUUSD" ? 0.15 : 15.0;
  const swings = detectStructuralSwings(candles, 3, 2, minMove);
  const m3Lows = swings.filter((s) => s.type === "LOW");
  const m3Highs = swings.filter((s) => s.type === "HIGH");

  // =========================================================================
  // BULLISH ENTRY CONFIRMATION
  // =========================================================================
  if (m15Trend.trend === "BULLISH" && m5Setup.type === "VALID_BULLISH_RETEST") {
    // 1. Identify relevant structural swing low for SL anchor
    const m3RecentLow = m3Lows.length > 0 ? m3Lows[m3Lows.length - 1].price : null;
    const m5RecentLow = m5Setup.structuralSwingPoint ? m5Setup.structuralSwingPoint.price : null;
    const anchorLow =
      m3RecentLow && m5RecentLow
        ? Math.min(m3RecentLow, m5RecentLow)
        : m3RecentLow || m5RecentLow || Math.min(...candles.slice(-8).map((c) => c.low));

    // 2. Responsive Scalping Trigger (checks closed candle `prev` or active candle `latest`)
    const isPrevGreen = prev.close > prev.open;
    const isLatestGreen = latest.close >= latest.open;
    const prevLowerWick = Math.min(prev.open, prev.close) - prev.low;
    const prevBody = Math.abs(prev.close - prev.open);
    const isPrevWickRejection = prevLowerWick >= prevBody * 0.35;

    const isEngulfing = isLatestGreen && latest.close >= prev.high;
    const isFlow = latest.close >= prev.close;

    const isConfirmed = isPrevGreen || isLatestGreen || isPrevWickRejection || isFlow;
    const momentumStrength = isEngulfing ? 0.9 : (isLatestGreen && isPrevGreen) ? 0.85 : 0.75;

    if (isConfirmed) {
      return {
        isConfirmed: true,
        reason: `M3 Bullish Entry Confirmed: ${
          isEngulfing
            ? "Bullish Momentum Engulfing above " + prev.high.toFixed(2)
            : isPrevWickRejection
            ? "Support Rejection Wick"
            : "Bullish Micro Momentum Continuation"
        }`,
        entryPrice: latest.close,
        triggerCandle: latest,
        structuralAnchorLow: anchorLow,
        structuralAnchorHigh: null,
        momentumStrength,
      };
    }

    return {
      isConfirmed: false,
      reason: "M3 Entry waiting for bullish momentum trigger candle",
      entryPrice: null,
      triggerCandle: latest,
      structuralAnchorLow: anchorLow,
      structuralAnchorHigh: null,
      momentumStrength,
    };
  }

  // =========================================================================
  // BEARISH ENTRY CONFIRMATION
  // =========================================================================
  if (m15Trend.trend === "BEARISH" && m5Setup.type === "VALID_BEARISH_RETEST") {
    const m3RecentHigh = m3Highs.length > 0 ? m3Highs[m3Highs.length - 1].price : null;
    const m5RecentHigh = m5Setup.structuralSwingPoint ? m5Setup.structuralSwingPoint.price : null;
    const anchorHigh =
      m3RecentHigh && m5RecentHigh
        ? Math.max(m3RecentHigh, m5RecentHigh)
        : m3RecentHigh || m5RecentHigh || Math.max(...candles.slice(-8).map((c) => c.high));

    const isPrevRed = prev.close < prev.open;
    const isLatestRed = latest.close <= latest.open;
    const prevUpperWick = prev.high - Math.max(prev.open, prev.close);
    const prevBody = Math.abs(prev.close - prev.open);
    const isPrevWickRejection = prevUpperWick >= prevBody * 0.35;

    const isBreakdown = isLatestRed && latest.close <= prev.low;
    const isFlow = latest.close <= prev.close;

    const isConfirmed = isPrevRed || isLatestRed || isPrevWickRejection || isFlow;
    const momentumStrength = isBreakdown ? 0.9 : (isLatestRed && isPrevRed) ? 0.85 : 0.75;

    if (isConfirmed) {
      return {
        isConfirmed: true,
        reason: `M3 Bearish Entry Confirmed: ${
          isBreakdown
            ? "Bearish Momentum Breakdown below " + prev.low.toFixed(2)
            : isPrevWickRejection
            ? "Resistance Rejection Wick"
            : "Bearish Micro Momentum Continuation"
        }`,
        entryPrice: latest.close,
        triggerCandle: latest,
        structuralAnchorLow: null,
        structuralAnchorHigh: anchorHigh,
        momentumStrength,
      };
    }

    return {
      isConfirmed: false,
      reason: "M3 Entry waiting for bearish momentum trigger candle",
      entryPrice: null,
      triggerCandle: latest,
      structuralAnchorLow: null,
      structuralAnchorHigh: anchorHigh,
      momentumStrength,
    };
  }

  return {
    isConfirmed: false,
    reason: "M3 Entry direction mismatch with M15/M5 structure",
    entryPrice: null,
    triggerCandle: null,
    structuralAnchorLow: null,
    structuralAnchorHigh: null,
    momentumStrength: 0,
  };
}
