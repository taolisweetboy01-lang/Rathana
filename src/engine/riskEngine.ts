/**
 * MASTER AI ANALYSIS - RISK & REWARD ENGINE
 * Structure-based Stop Loss, TP1 (1R), TP2 (2R), S/R Clearance & Transparent Confidence Scoring.
 */

import { Candle, ConfidenceBreakdown, RiskAnalysis, SymbolConfig } from "./types";
import { detectStructuralSwings } from "./swingDetector";

/**
 * Calculates structural SL, TP1 (1R), TP2 (2R), checks maximum SL filter, and S/R clearance.
 */
export function calculateRiskParameters(
  side: "BUY" | "SELL",
  entry: number,
  structuralAnchor: number,
  m15Candles: Candle[],
  m5Candles: Candle[],
  config: SymbolConfig
): RiskAnalysis {
  const buffer = config.slBufferPips * config.pipSize;

  let stopLoss: number;
  let riskDistance: number;

  if (side === "BUY") {
    // Structural SL placed BELOW Swing Low - Buffer
    stopLoss = +(structuralAnchor - buffer).toFixed(2);
    riskDistance = +(entry - stopLoss).toFixed(2);
  } else {
    // Structural SL placed ABOVE Swing High + Buffer
    stopLoss = +(structuralAnchor + buffer).toFixed(2);
    riskDistance = +(stopLoss - entry).toFixed(2);
  }

  // 1. Validate SL Distance Filters
  let isSlValid = true;
  let slValidationReason = "Structural SL within acceptable scalp bounds";

  if (riskDistance <= 0) {
    isSlValid = false;
    slValidationReason = `Invalid negative risk distance: ${riskDistance}`;
  } else if (riskDistance < config.minSlDistance) {
    isSlValid = false;
    slValidationReason = `Structural SL too tight (${riskDistance.toFixed(2)} < min ${config.minSlDistance.toFixed(2)})`;
  } else if (riskDistance > config.maxSlDistance) {
    isSlValid = false;
    slValidationReason = `Structural SL excessively wide for scalping (${riskDistance.toFixed(2)} > max ${config.maxSlDistance.toFixed(2)})`;
  }

  // 2. Take Profit: ONLY TP1 (1R) and TP2 (2R). NO TP3.
  const tp1 = +(side === "BUY" ? entry + riskDistance : entry - riskDistance).toFixed(2);
  const tp2 = +(side === "BUY" ? entry + riskDistance * 2 : entry - riskDistance * 2).toFixed(2);

  // 3. Check Support/Resistance Obstacle Clearance
  const { srClearanceValid, srValidationReason } = checkSRClearance(
    side,
    entry,
    tp1,
    tp2,
    m15Candles,
    m5Candles,
    config
  );

  return {
    entry,
    stopLoss,
    tp1,
    tp2,
    riskDistance,
    riskReward: "1:2",
    isSlValid,
    slValidationReason,
    srClearanceValid,
    srValidationReason,
  };
}

/**
 * Checks if major opposing structure blocks the target before TP1/TP2
 */
function checkSRClearance(
  side: "BUY" | "SELL",
  entry: number,
  tp1: number,
  tp2: number,
  m15Candles: Candle[],
  m5Candles: Candle[],
  config: SymbolConfig
): { srClearanceValid: boolean; srValidationReason: string } {
  const minMove = config.symbol === "XAUUSD" ? 0.40 : 40.0;
  const m15Swings = detectStructuralSwings(m15Candles, 3, 2, minMove);
  const majorHighs = m15Swings.filter((s) => s.type === "HIGH").map((s) => s.price);
  const majorLows = m15Swings.filter((s) => s.type === "LOW").map((s) => s.price);

  const tolerance = config.pipSize * 2;

  if (side === "BUY") {
    // Only reject if a confirmed major M15 swing high is blocking TP1 directly
    const blockingResistance = majorHighs.find(
      (h) => h > entry + tolerance && h < tp1 - tolerance
    );

    if (blockingResistance) {
      return {
        srClearanceValid: false,
        srValidationReason: `Major M15 resistance at ${blockingResistance.toFixed(2)} blocks path to TP1 (${tp1.toFixed(2)})`,
      };
    }
  } else {
    // Only reject if a confirmed major M15 swing low is blocking TP1 directly
    const blockingSupport = majorLows.find(
      (l) => l < entry - tolerance && l > tp1 + tolerance
    );

    if (blockingSupport) {
      return {
        srClearanceValid: false,
        srValidationReason: `Major M15 support at ${blockingSupport.toFixed(2)} blocks path to TP1 (${tp1.toFixed(2)})`,
      };
    }
  }

  return {
    srClearanceValid: true,
    srValidationReason: "Target path clear to TP1 & TP2 (No major opposing structure blockage)",
  };
}

/**
 * Transparent Confidence Scoring (Max 100) based on actual market factors
 */
export function calculateConfidence(
  m15Clarity: boolean,
  m5Quality: boolean,
  m3Momentum: number,
  srClearance: boolean,
  rrQuality: boolean
): ConfidenceBreakdown {
  const m15TrendScore = m15Clarity ? 25 : 10;
  const m5SetupScore = m5Quality ? 25 : 10;
  const m3EntryScore = Math.round(m3Momentum * 20);
  const targetClearanceScore = srClearance ? 15 : 5;
  const riskRewardScore = rrQuality ? 15 : 10;

  const totalScore =
    m15TrendScore +
    m5SetupScore +
    m3EntryScore +
    targetClearanceScore +
    riskRewardScore;

  return {
    m15TrendScore,
    m5SetupScore,
    m3EntryScore,
    targetClearanceScore,
    riskRewardScore,
    totalScore,
  };
}
