/**
 * MASTER AI ANALYSIS - M15 TREND ENGINE (OPTIMIZED FOR SCALPING)
 * Combines Market Structure (HH/HL vs LH/LL) with Dynamic EMA Flow & Range Order Flow.
 * Guarantees responsive, non-stagnant directional bias for active scalpers.
 */

import { Candle, M15TrendAnalysis, SymbolConfig, TrendDirection } from "./types";
import { detectStructuralSwings } from "./swingDetector";

function calculateEMA(candles: Candle[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  if (candles.length === 0) return ema;

  let prev = candles[0].close;
  ema.push(prev);

  for (let i = 1; i < candles.length; i++) {
    const val = candles[i].close * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

export function analyzeM15Trend(
  candles: Candle[],
  config: SymbolConfig
): M15TrendAnalysis {
  if (!candles || candles.length < 15) {
    return {
      trend: "UNCLEAR",
      reason: "Insufficient M15 candle history",
      swings: [],
      recentHigh: null,
      recentLow: null,
      higherHighCount: 0,
      lowerLowCount: 0,
      bosDetected: false,
      bosLevel: null,
    };
  }

  // Adjust min move dynamically based on asset volatility
  const minMove = config.symbol === "XAUUSD" ? 0.25 : 25.0;
  const swings = detectStructuralSwings(candles, 3, 2, minMove);

  const swingHighs = swings.filter((s) => s.type === "HIGH");
  const swingLows = swings.filter((s) => s.type === "LOW");

  const currentPrice = candles[candles.length - 1].close;

  // EMAs for Dynamic Scalping Flow
  const ema9 = calculateEMA(candles, 9);
  const ema21 = calculateEMA(candles, 21);
  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];
  const isEmaBullish = currentEma9 >= currentEma21;

  // Check recent swings
  const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : Math.max(...candles.slice(-10).map((c) => c.high));
  const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : Math.min(...candles.slice(-10).map((c) => c.low));

  const prevHigh = swingHighs.length > 1 ? swingHighs[swingHighs.length - 2].price : lastHigh;
  const prevLow = swingLows.length > 1 ? swingLows[swingLows.length - 2].price : lastLow;

  const isHH = lastHigh >= prevHigh;
  const isHL = lastLow >= prevLow;
  const isLH = lastHigh <= prevHigh;
  const isLL = lastLow <= prevLow;

  // Break of Structure
  const isBullishBos = currentPrice > lastHigh;
  const isBearishBos = currentPrice < lastLow;

  let trend: TrendDirection = "UNCLEAR";
  let reason = "";

  // 1. Trending Structure or BOS
  if (isBullishBos || (isHH && isHL && isEmaBullish)) {
    trend = "BULLISH";
    reason = `M15 Bullish Flow: ${isBullishBos ? "BOS Breakout above " + lastHigh.toFixed(2) : "Higher Highs & Lows above EMA-21 (" + currentEma21.toFixed(2) + ")"}`;
  } else if (isBearishBos || (isLH && isLL && !isEmaBullish)) {
    trend = "BEARISH";
    reason = `M15 Bearish Flow: ${isBearishBos ? "BOS Breakdown below " + lastLow.toFixed(2) : "Lower Highs & Lows below EMA-21 (" + currentEma21.toFixed(2) + ")"}`;
  }
  // 2. Active Scalping Consolidation / Range Order Flow (DO NOT FREEZE SCALPER!)
  else if (isEmaBullish && currentPrice >= (lastLow + lastHigh) / 2) {
    trend = "BULLISH";
    reason = `M15 Bullish Order Flow holding above EMA-21 (${currentEma21.toFixed(2)}) toward range high ${lastHigh.toFixed(2)}`;
  } else if (!isEmaBullish && currentPrice <= (lastLow + lastHigh) / 2) {
    trend = "BEARISH";
    reason = `M15 Bearish Order Flow holding below EMA-21 (${currentEma21.toFixed(2)}) toward range low ${lastLow.toFixed(2)}`;
  } else if (currentPrice >= lastLow) {
    // Range bounce
    trend = currentPrice > currentEma21 ? "BULLISH" : "BEARISH";
    reason = `M15 Range Scalp Bias (${trend}) aligned with EMA-21 (${currentEma21.toFixed(2)})`;
  }

  return {
    trend,
    reason,
    swings,
    recentHigh: lastHigh,
    recentLow: lastLow,
    higherHighCount: isHH ? 1 : 0,
    lowerLowCount: isLL ? 1 : 0,
    bosDetected: isBullishBos || isBearishBos,
    bosLevel: isBullishBos ? lastHigh : isBearishBos ? lastLow : null,
  };
}
