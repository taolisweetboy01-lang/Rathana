/**
 * MASTER AI ANALYSIS - SWING DETECTION ENGINE
 * Robust structural swing high and swing low detection.
 * Guarantees NO REPAINT by requiring confirmation candles to the right.
 */

import { Candle, SwingPoint } from "./types";

export function detectStructuralSwings(
  candles: Candle[],
  lookback: number = 4,
  confirmationCandles: number = 2,
  minStructuralMove: number = 0.05
): SwingPoint[] {
  if (!candles || candles.length < lookback + confirmationCandles + 1) {
    return [];
  }

  const swings: SwingPoint[] = [];

  // Iterate up to the last confirmed candle (do not examine developing candles beyond right window)
  const maxEvalIndex = candles.length - confirmationCandles - 1;

  for (let i = lookback; i <= maxEvalIndex; i++) {
    const current = candles[i];

    // Check Swing High
    let isSwingHigh = true;
    for (let l = 1; l <= lookback; l++) {
      if (candles[i - l].high >= current.high) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      for (let r = 1; r <= confirmationCandles; r++) {
        if (candles[i + r].high > current.high) {
          isSwingHigh = false;
          break;
        }
      }
    }

    if (isSwingHigh) {
      // Noise filter
      const avgLeftClose =
        candles.slice(i - lookback, i).reduce((sum, c) => sum + c.close, 0) / lookback;
      if (Math.abs(current.high - avgLeftClose) >= minStructuralMove) {
        swings.push({
          index: i,
          time: current.time,
          price: current.high,
          type: "HIGH",
          isConfirmed: true,
        });
        continue;
      }
    }

    // Check Swing Low
    let isSwingLow = true;
    for (let l = 1; l <= lookback; l++) {
      if (candles[i - l].low <= current.low) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      for (let r = 1; r <= confirmationCandles; r++) {
        if (candles[i + r].low < current.low) {
          isSwingLow = false;
          break;
        }
      }
    }

    if (isSwingLow) {
      const avgLeftClose =
        candles.slice(i - lookback, i).reduce((sum, c) => sum + c.close, 0) / lookback;
      if (Math.abs(avgLeftClose - current.low) >= minStructuralMove) {
        swings.push({
          index: i,
          time: current.time,
          price: current.low,
          type: "LOW",
          isConfirmed: true,
        });
      }
    }
  }

  return swings;
}
