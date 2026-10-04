/**
 * MASTER AI ANALYSIS - CONFIGURATION
 * Symbol-specific parameters for XAUUSD and BTCUSD
 */

import { SupportedSymbol, SymbolConfig } from "./types";

export const SYMBOL_CONFIGS: Record<SupportedSymbol, SymbolConfig> = {
  XAUUSD: {
    symbol: "XAUUSD",
    feedSymbol: "PAXGUSDT",
    pipSize: 0.1,             // 1 pip = $0.10
    pointMultiplier: 1.0,     // 1 dollar move
    slBufferPips: 3.5,        // 0.35 buffer past structural swing
    minSlDistance: 0.40,      // Minimum structural SL distance
    maxSlDistance: 6.50,      // Maximum allowed structural SL distance (Reject trade if larger)
    minRiskReward: 1.5,       // Minimum acceptable R:R
    swingLookback: 4,         // Candles before/after to qualify swing
    confirmationCandles: 2,   // Confirmation candles to guarantee no-repaint
    maxSignalAgeMinutes: 45,  // Signal expiration window
  },
  BTCUSD: {
    symbol: "BTCUSD",
    feedSymbol: "BTCUSDT",
    pipSize: 1.0,             // 1 point = $1.00
    pointMultiplier: 1.0,
    slBufferPips: 25.0,       // $25.00 buffer past structural swing
    minSlDistance: 35.0,      // Minimum structural SL distance
    maxSlDistance: 480.0,     // Maximum allowed structural SL distance (Reject trade if larger)
    minRiskReward: 1.5,       // Minimum acceptable R:R
    swingLookback: 4,
    confirmationCandles: 2,
    maxSignalAgeMinutes: 45,
  },
};

export function getSymbolConfig(symbol: SupportedSymbol): SymbolConfig {
  const config = SYMBOL_CONFIGS[symbol];
  if (!config) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }
  return config;
}
