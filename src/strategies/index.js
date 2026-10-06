/**
 * ============================================================================
 * STRATEGY REGISTRY (JavaScript Gateway)
 * ============================================================================
 */

import {
  registeredStrategies,
  ALL_STRATEGIES,
  strategy01_break_retest,
  strategy02_ema_ribbon,
  strategy03_liquidity_sweep,
  getStrategyById,
  getStrategyByNumber,
  runStrategy,
  priceActionScalperStrategy,
  quantScalperStrategy,
  ictSmcStrategy,
  DEFAULT_STRATEGY_SOUNDS,
  STORAGE_KEY_STRATEGY_SOUND,
  STORAGE_KEY_ACTIVE_STRATEGY,
} from "./index.ts";

export {
  registeredStrategies,
  ALL_STRATEGIES,
  strategy01_break_retest,
  strategy02_ema_ribbon,
  strategy03_liquidity_sweep,
  getStrategyById,
  getStrategyByNumber,
  runStrategy,
  priceActionScalperStrategy,
  quantScalperStrategy,
  ictSmcStrategy,
  DEFAULT_STRATEGY_SOUNDS,
  STORAGE_KEY_STRATEGY_SOUND,
  STORAGE_KEY_ACTIVE_STRATEGY,
};
