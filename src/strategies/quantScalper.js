/**
 * ============================================================================
 * STRATEGY 1: MASTER QUANT SCALPER PRO
 * ============================================================================
 */
import {
  calculateEMA,
  calculateRSI,
  calculateATR,
} from "../services/quantScalper.js";

export const quantScalperStrategy = {
  id: "strat_scalper",
  name: "Master Quant Scalper Pro (EMA 9/21 + RSI + ATR)",
  category: "Quantitative Scalping",
  timeframe: "M1",
  description: "ក្បួន Scalping គណិតវិទ្យាពិតប្រាកដ៖ EMA 9/21 Ribbon + RSI 14 Filter + ATR Dynamic Risk Range",
  winRate: "Dynamic",
  profitFactor: "Dynamic",
  tradesCount: "Dynamic",
  netRR: "Dynamic",
  maxDrawdown: "Dynamic",
  defaultRR: "1:2",

  evaluate(market, klines, currentPrice) {
    if (!klines || klines.length < 25 || !currentPrice) return null;

    const closes = klines.map((k) => k.close);
    const highs = klines.map((k) => k.high);
    const lows = klines.map((k) => k.low);

    const ema9Series = calculateEMA(closes, 9);
    const ema21Series = calculateEMA(closes, 21);
    const currentEMA9 = ema9Series[ema9Series.length - 1];
    const currentEMA21 = ema21Series[ema21Series.length - 1];
    const rsi = calculateRSI(closes, 14);
    const atr = calculateATR(highs, lows, closes, 14);

    const isGold = market === "XAUUSD";
    const minSl = isGold ? 0.40 : 30.0;
    const slBuffer = Math.max(atr * 1.4, minSl);
    const emaDiffPct = (Math.abs(currentEMA9 - currentEMA21) / currentPrice) * 100;
    const isCompressing = emaDiffPct < 0.008;

    let side = "WAIT";
    let status = "ACTIVE";
    let reason = "";

    if (currentEMA9 > currentEMA21 && rsi >= 48 && rsi <= 75 && currentPrice >= currentEMA9 && !isCompressing) {
      side = "BUY";
      reason = `EMA 9/21 Bullish Cross (EMA9 > EMA21) + RSI (${rsi}) Bullish Momentum. Dynamic ATR: ${atr.toFixed(2)}.`;
    } else if (currentEMA9 < currentEMA21 && rsi <= 52 && rsi >= 25 && currentPrice <= currentEMA9 && !isCompressing) {
      side = "SELL";
      reason = `EMA 9/21 Bearish Cross (EMA9 < EMA21) + RSI (${rsi}) Bearish Momentum. Dynamic ATR: ${atr.toFixed(2)}.`;
    } else {
      side = currentEMA9 >= currentEMA21 ? "BUY" : "SELL";
      reason = `EMA Micro Flow (${side}). Trend Momentum continuation.`;
    }

    const isBuy = side === "BUY";
    const entry = currentPrice;
    const sl = isBuy ? entry - slBuffer : entry + slBuffer;
    const tp1 = isBuy ? entry + slBuffer * 1.5 : entry - slBuffer * 1.5;
    const tp2 = isBuy ? entry + slBuffer * 2.5 : entry - slBuffer * 2.5;

    return {
      symbol: market,
      side,
      status: "ACTIVE",
      entry,
      sl,
      tp1,
      tp1_rr: "1:1.5",
      tp2,
      tp2_rr: "1:2.5",
      tp2_reason: reason,
      strategy: this.name,
      timeframe: this.timeframe,
      timestamp: Date.now(),
      source: "Binance Live Engine",
      indicators: { ema9: currentEMA9, ema21: currentEMA21, rsi, atr },
    };
  },
};
