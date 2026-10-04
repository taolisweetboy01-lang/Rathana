/**
 * ============================================================================
 * STRATEGY REGISTRY (កន្លែងប្រមូលផ្តុំ STRATEGY ទាំងអស់ក្នុង App)
 * ============================================================================
 */

import { priceActionScalperStrategy } from "./priceActionScalper.js";
import { quantScalperStrategy } from "./quantScalper.js";
import { ictSmcStrategy } from "./ictSmc.js";

// បញ្ជី Strategy ទាំងអស់
export const ALL_STRATEGIES = [
  priceActionScalperStrategy, // 👈 យុទ្ធសាស្ត្រថ្មីរបស់អ្នក (Price Action Scalper M1, RR 1:1, RR 1:2)
  quantScalperStrategy,
  ictSmcStrategy,
];

// Helper ស្វែងរក Strategy តាម ID
export function getStrategyById(strategyId) {
  return (
    ALL_STRATEGIES.find((s) => s.id === strategyId) || ALL_STRATEGIES[0]
  );
}

// Helper ដំណើរការ Strategy គណនា Signal
export function runStrategy(strategyId, market, klines, currentPrice) {
  const strategy = getStrategyById(strategyId);
  if (strategy && typeof strategy.evaluate === "function") {
    return strategy.evaluate(market, klines, currentPrice);
  }
  return null;
}
