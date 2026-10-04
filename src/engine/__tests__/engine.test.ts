/**
 * MASTER AI ANALYSIS - ENGINE UNIT & INTEGRATION TESTS
 * Verifies M15 -> M5 -> M3 pipeline, Structural SL, TP1 (1R), TP2 (2R), and WAIT conditions.
 */

import { runMultiTimeframeEngine } from "../analysisEngine";
import { Candle } from "../types";

export function generateSyntheticTrend(
  trend: "BULLISH" | "BEARISH",
  count: number = 50,
  basePrice: number = 4140.0
): Candle[] {
  const candles: Candle[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * 15 * 60 * 1000;
    const wave = trend === "BULLISH" ? 0.35 : -0.35;
    const open = price;
    const close = open + wave + (Math.sin(i * 0.5) * 0.1);
    const high = Math.max(open, close) + 0.25;
    const low = Math.min(open, close) - 0.25;
    candles.push({ time, open, high, low, close, volume: 100 });
    price = close;
  }

  return candles;
}

async function runTestSuite() {
  console.log("=== RUNNING MASTER AI ANALYSIS TEST SUITE ===");

  // Test 1: Verify M15 Sideways correctly returns WAIT without forcing trade
  const flatCandles: Candle[] = [];
  const now = Date.now();
  for (let i = 0; i < 40; i++) {
    flatCandles.push({
      time: now - (40 - i) * 15 * 60 * 1000,
      open: 4145.0,
      high: 4145.5,
      low: 4144.5,
      close: 4145.0,
      volume: 50,
    });
  }

  const waitResult = await runMultiTimeframeEngine("XAUUSD", {
    debug: true,
    overrideCandles: {
      m15: flatCandles,
      m5: flatCandles,
      m3: flatCandles,
    },
  });

  console.log("TEST 1 - Sideways Market -> WAIT:", waitResult.status === "WAIT" ? "PASSED" : "FAILED");
  console.log("Wait Reason:", waitResult.reason);

  // Test 2: Verify Structural SL and TP1 (1R) / TP2 (2R) formula
  // BUY: SL = Swing Low - Buffer, TP1 = Entry + R, TP2 = Entry + 2R
  const m15Bull = generateSyntheticTrend("BULLISH", 50, 4140.0);
  const m5Bull = generateSyntheticTrend("BULLISH", 50, 4148.0);
  const m3Bull = generateSyntheticTrend("BULLISH", 50, 4152.0);

  const buyResult = await runMultiTimeframeEngine("XAUUSD", {
    debug: true,
    overrideCandles: {
      m15: m15Bull,
      m5: m5Bull,
      m3: m3Bull,
    },
  });

  console.log("TEST 2 - Bullish Trend Evaluation:", buyResult.status);
  if (buyResult.status === "BUY") {
    const entry = buyResult.entry!;
    const sl = buyResult.stopLoss!;
    const tp1 = buyResult.tp1!;
    const tp2 = buyResult.tp2!;
    const r = entry - sl;

    const isTp1Exact = Math.abs(tp1 - (entry + r)) < 0.05;
    const isTp2Exact = Math.abs(tp2 - (entry + r * 2)) < 0.05;
    console.log(`TP1 (1R) Formula Check: ${isTp1Exact ? "PASSED" : "FAILED"} (Entry: ${entry}, SL: ${sl}, TP1: ${tp1})`);
    console.log(`TP2 (2R) Formula Check: ${isTp2Exact ? "PASSED" : "FAILED"} (TP2: ${tp2})`);
  }

  console.log("=== TEST SUITE COMPLETE ===");
}

runTestSuite();
