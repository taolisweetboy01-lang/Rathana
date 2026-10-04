/**
 * MASTER AI ANALYSIS - M5 SETUP ENGINE (OPTIMIZED FOR SCALPING)
 * Identifies Breakout + Retest or Value Zone Pullbacks aligned with M15 Trend.
 */

import { Candle, M5SetupAnalysis, M15TrendAnalysis, SymbolConfig, SwingPoint } from "./types";
import { detectStructuralSwings } from "./swingDetector";

export function analyzeM5Setup(
  candles: Candle[],
  m15Trend: M15TrendAnalysis,
  config: SymbolConfig
): M5SetupAnalysis {
  if (!candles || candles.length < 15) {
    return {
      isValid: false,
      type: "NO_VALID_M5_SETUP",
      reason: "Insufficient M5 candle history",
      breakoutLevel: null,
      retestZoneLow: null,
      retestZoneHigh: null,
      structuralSwingPoint: null,
    };
  }

  // Strict alignment with M15 Direction
  if (m15Trend.trend !== "BULLISH" && m15Trend.trend !== "BEARISH") {
    return {
      isValid: false,
      type: "NO_VALID_M5_SETUP",
      reason: `M15 Trend is ${m15Trend.trend} (Waiting for directional consensus)`,
      breakoutLevel: null,
      retestZoneLow: null,
      retestZoneHigh: null,
      structuralSwingPoint: null,
    };
  }

  const minMove = config.symbol === "XAUUSD" ? 0.20 : 20.0;
  const swings = detectStructuralSwings(candles, 3, 2, minMove);

  const swingHighs = swings.filter((s) => s.type === "HIGH");
  const swingLows = swings.filter((s) => s.type === "LOW");

  const currentPrice = candles[candles.length - 1].close;
  const latestCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  // =========================================================================
  // BULLISH SETUP: Breakout/Retest or Pullback to Support with Bullish Reaction
  // =========================================================================
  if (m15Trend.trend === "BULLISH") {
    const keyLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : {
      index: candles.length - 3,
      time: candles[candles.length - 3]?.time || Date.now(),
      price: Math.min(...candles.slice(-8).map((c) => c.low)),
      type: "LOW" as const,
      isConfirmed: true,
    };

    const keyHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;
    const retestLevel = keyHigh ? keyHigh.price : keyLow.price;

    const lowerWick = Math.min(latestCandle.open, latestCandle.close) - latestCandle.low;
    const body = Math.abs(latestCandle.close - latestCandle.open);
    const isBullishReaction =
      latestCandle.close >= latestCandle.open ||
      lowerWick >= body * 0.3 ||
      latestCandle.close >= prevCandle.close;

    // Check if price is holding above recent support
    const isHoldingSupport = currentPrice >= keyLow.price;

    if (isHoldingSupport && isBullishReaction) {
      return {
        isValid: true,
        type: "VALID_BULLISH_RETEST",
        reason: `M5 Bullish Retest / Support Zone Valid (Holding above ${keyLow.price.toFixed(2)}) with bullish reaction`,
        breakoutLevel: retestLevel,
        retestZoneLow: keyLow.price,
        retestZoneHigh: keyHigh ? keyHigh.price : currentPrice,
        structuralSwingPoint: keyLow,
      };
    }

    return {
      isValid: false,
      type: "NO_VALID_M5_SETUP",
      reason: `Waiting for M5 Bullish Support/Retest reaction above ${keyLow.price.toFixed(2)}`,
      breakoutLevel: retestLevel,
      retestZoneLow: keyLow.price,
      retestZoneHigh: keyHigh ? keyHigh.price : currentPrice,
      structuralSwingPoint: keyLow,
    };
  }

  // =========================================================================
  // BEARISH SETUP: Breakdown/Retest or Rally to Resistance with Bearish Reaction
  // =========================================================================
  if (m15Trend.trend === "BEARISH") {
    const keyHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : {
      index: candles.length - 3,
      time: candles[candles.length - 3]?.time || Date.now(),
      price: Math.max(...candles.slice(-8).map((c) => c.high)),
      type: "HIGH" as const,
      isConfirmed: true,
    };

    const keyLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;
    const retestLevel = keyLow ? keyLow.price : keyHigh.price;

    const upperWick = latestCandle.high - Math.max(latestCandle.open, latestCandle.close);
    const body = Math.abs(latestCandle.close - latestCandle.open);
    const isBearishReaction =
      latestCandle.close <= latestCandle.open ||
      upperWick >= body * 0.3 ||
      latestCandle.close <= prevCandle.close;

    const isHoldingResistance = currentPrice <= keyHigh.price;

    if (isHoldingResistance && isBearishReaction) {
      return {
        isValid: true,
        type: "VALID_BEARISH_RETEST",
        reason: `M5 Bearish Retest / Resistance Zone Valid (Holding below ${keyHigh.price.toFixed(2)}) with bearish reaction`,
        breakoutLevel: retestLevel,
        retestZoneLow: keyLow ? keyLow.price : currentPrice,
        retestZoneHigh: keyHigh.price,
        structuralSwingPoint: keyHigh,
      };
    }

    return {
      isValid: false,
      type: "NO_VALID_M5_SETUP",
      reason: `Waiting for M5 Bearish Resistance/Retest reaction below ${keyHigh.price.toFixed(2)}`,
      breakoutLevel: retestLevel,
      retestZoneLow: keyLow ? keyLow.price : currentPrice,
      retestZoneHigh: keyHigh.price,
      structuralSwingPoint: keyHigh,
    };
  }

  return {
    isValid: false,
    type: "NO_VALID_M5_SETUP",
    reason: "No clear M5 setup found",
    breakoutLevel: null,
    retestZoneLow: null,
    retestZoneHigh: null,
    structuralSwingPoint: null,
  };
}
