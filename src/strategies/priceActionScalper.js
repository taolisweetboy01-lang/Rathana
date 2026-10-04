/**
 * ============================================================================
 * STRATEGY: DYNAMIC PRICE ACTION SCALPER M1
 * ============================================================================
 * - Timeframe: 1M (Entry រហ័ស)
 * - Support & Resistance: គណនាពី Recent Swing High & Swing Low នៃ 15 ទៀនចុងក្រោយ
 * - Price Action Confirmation: ទៀន Pin Bar, Rejection Wick, ឬ Engulfing Breakout
 * - Risk to Reward:
 *     + Stop Loss: 1:1 (SL)
 *     + Take Profit 1: RR 1:1 (TP1)
 *     + Take Profit 2: RR 1:2 (TP2)
 */

export const priceActionScalperStrategy = {
  id: "strat_price_action_m1",
  name: "Price Action Scalper M1 (S/R + PA)",
  category: "Price Action Scalping",
  timeframe: "M1",
  description: "ចូល Trade រហ័សលើ M1 ផ្អែកលើ Support/Resistance Bounce & Breakout ជាមួយ TP1 (1:1), TP2 (1:2), SL (1:1)",
  winRate: "Dynamic",
  profitFactor: "Dynamic",
  tradesCount: "Dynamic",
  netRR: "Dynamic",
  maxDrawdown: "Dynamic",
  defaultRR: "1:2",

  evaluate(market, klines, currentPrice) {
    if (!klines || klines.length < 15 || !currentPrice) {
      return null;
    }

    // 1. រក Support & Resistance ពី 15 ទៀនចុងក្រោយ
    const lookback = klines.slice(-15);
    const resistance = Math.max(...lookback.map((k) => k.high));
    const support = Math.min(...lookback.map((k) => k.low));
    const range = Math.max(resistance - support, 0.01);

    const curr = lookback[lookback.length - 1];
    const prev = lookback[lookback.length - 2];

    const isGold = market === "XAUUSD";

    // M1 Scalp SL Distance គណនាតាមចង្វាក់ទៀន M1 ជាក់ស្តែង (Real Volatility)
    const slDist = isGold
      ? Math.max(range * 0.6, 0.45)
      : Math.max(range * 0.6, 35.0);

    // 2. ពិនិត្យ Price Action (Candle Behavior)
    const isGreenCandle = curr.close >= curr.open;
    const isRedCandle = curr.close < curr.open;

    const bodySize = Math.abs(curr.close - curr.open);
    const upperWick = curr.high - Math.max(curr.open, curr.close);
    const lowerWick = Math.min(curr.open, curr.close) - curr.low;

    const distToSupport = Math.abs(currentPrice - support);
    const distToResistance = Math.abs(currentPrice - resistance);

    // លក្ខខណ្ឌ BUY (Support Bounce ឬ Bullish Momentum Breakout):
    const isSupportBounce = (distToSupport / range <= 0.45) && (lowerWick >= bodySize * 0.4 || isGreenCandle);
    const isBullishBreakout = isGreenCandle && (curr.close >= prev.high || (curr.close > prev.close && isGreenCandle));

    // លក្ខខណ្ឌ SELL (Resistance Rejection ឬ Bearish Momentum Breakout):
    const isResistanceReject = (distToResistance / range <= 0.45) && (upperWick >= bodySize * 0.4 || isRedCandle);
    const isBearishBreakdown = isRedCandle && (curr.close <= prev.low || (curr.close < prev.close && isRedCandle));

    let side = "WAIT";
    let status = "ACTIVE";
    let reason = "";

    if (isSupportBounce || isBullishBreakout) {
      side = "BUY";
      reason = isSupportBounce
        ? `Support Bounce at ${support.toFixed(2)} with Bullish Price Action Rejection. Target TP1 (1:1) & TP2 (1:2).`
        : `Bullish Price Action Continuation above ${prev.high.toFixed(2)}. Target TP1 (1:1) & TP2 (1:2).`;
    } else if (isResistanceReject || isBearishBreakdown) {
      side = "SELL";
      reason = isResistanceReject
        ? `Resistance Rejection at ${resistance.toFixed(2)} with Bearish Price Action Wick. Target TP1 (1:1) & TP2 (1:2).`
        : `Bearish Price Action Breakdown below ${prev.low.toFixed(2)}. Target TP1 (1:1) & TP2 (1:2).`;
    } else {
      side = isGreenCandle ? "BUY" : "SELL";
      reason = `M1 Price Action Micro Flow (${isGreenCandle ? "Bullish" : "Bearish"}). S: ${support.toFixed(2)} | R: ${resistance.toFixed(2)}.`;
    }

    const isBuy = side === "BUY";
    const entry = currentPrice;

    // SL 1:1
    const sl = isBuy ? entry - slDist : entry + slDist;
    // TP1 RR 1:1
    const tp1 = isBuy ? entry + slDist : entry - slDist;
    // TP2 RR 1:2
    const tp2 = isBuy ? entry + (slDist * 2) : entry - (slDist * 2);

    return {
      symbol: market,
      side,
      status: "ACTIVE",
      entry,
      sl,
      tp1,
      tp1_rr: "1:1",
      tp2,
      tp2_rr: "1:2",
      tp2_reason: reason,
      strategy: this.name,
      timeframe: "M1",
      timestamp: Date.now(),
      source: "Binance M1 Price Action Engine",
      indicators: {
        support,
        resistance,
        slDistance: slDist,
      },
    };
  },
};
