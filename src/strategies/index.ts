/**
 * ============================================================================
 * CENTRAL STRATEGY REGISTRY (ប្រមូលផ្តុំ STRATEGY ទាំង 3 ក្នុង App)
 * ============================================================================
 * Modular File-Per-Strategy Registry:
 * - Strategy 01: Breakout & Structural Retest (strategy01_break_retest.ts)
 * - Strategy 02: EMA Ribbon & Momentum Flow (strategy02_ema_ribbon.ts)
 * - Strategy 03: ICT SMC Liquidity Sweep (strategy03_liquidity_sweep.ts)
 */

import { strategy01_break_retest } from "./strategy01_break_retest";
import { strategy02_ema_ribbon } from "./strategy02_ema_ribbon";
import { strategy03_liquidity_sweep } from "./strategy03_liquidity_sweep";
import type { TradingStrategy, Candle, StrategyEvaluationResult } from "./types";

export * from "./types";
export { strategy01_break_retest } from "./strategy01_break_retest";
export { strategy02_ema_ribbon } from "./strategy02_ema_ribbon";
export { strategy03_liquidity_sweep } from "./strategy03_liquidity_sweep";

// 3 Registered Strategies with sequential numbers 01, 02, 03
export const registeredStrategies: TradingStrategy[] = [
  strategy01_break_retest,
  strategy02_ema_ribbon,
  strategy03_liquidity_sweep,
];

// Compatibility alias
export const ALL_STRATEGIES = registeredStrategies;

// Backward-compatibility aliases for legacy imports
export const priceActionScalperStrategy = strategy01_break_retest;
export const quantScalperStrategy = strategy02_ema_ribbon;
export const ictSmcStrategy = strategy03_liquidity_sweep;

// Storage keys
export const STORAGE_KEY_STRATEGY_SOUND = "master_ai_strategy_sounds_v2";
export const STORAGE_KEY_ACTIVE_STRATEGY = "master_ai_active_strategy_number_v2";

// Default sound alert settings per strategy
export const DEFAULT_STRATEGY_SOUNDS: Record<string, boolean> = {
  "01": true,
  "02": true,
  "03": true,
};

// Helper to find strategy by ID
export function getStrategyById(strategyId: string): TradingStrategy {
  return (
    registeredStrategies.find((s) => s.id === strategyId) ||
    registeredStrategies[0]
  );
}

// Helper to find strategy by sequential number: "01" | "02" | "03"
export function getStrategyByNumber(num: string): TradingStrategy {
  return (
    registeredStrategies.find((s) => s.number === num) ||
    registeredStrategies[0]
  );
}

// Helper to run strategy evaluation
export function runStrategy(
  strategyId: string,
  market: string,
  klines: Candle[],
  currentPrice: number | null
): StrategyEvaluationResult | null {
  const strategy = getStrategyById(strategyId);
  if (strategy && typeof strategy.evaluate === "function") {
    return strategy.evaluate(market, klines, currentPrice);
  }
  return null;
}
