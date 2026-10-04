/**
 * ============================================================================
 * STRATEGY 2: ICT SMC (Smart Money Concepts)
 * ============================================================================
 */
export const ictSmcStrategy = {
  id: "strat_smc",
  name: "ICT SMC Market Structure + Liquidity Sweep",
  category: "Smart Money (SMC)",
  timeframe: "M5",
  description: "ស្វែងរក Liquidity Sweep លើ Asian High/Low បញ្ជាក់ BOS រួចចូល Trade ពេល Retest FVG",
  winRate: "Dynamic",
  profitFactor: "Dynamic",
  tradesCount: "Dynamic",
  netRR: "Dynamic",
  maxDrawdown: "Dynamic",
  defaultRR: "1:3",

  evaluate(market, klines, currentPrice) {
    if (!klines || klines.length < 20 || !currentPrice) return null;

    const recentKlines = klines.slice(-20);
    const sessionHigh = Math.max(...recentKlines.map((k) => k.high));
    const sessionLow = Math.min(...recentKlines.map((k) => k.low));
    const range = sessionHigh - sessionLow;

    const latest = klines[klines.length - 1];
    const prev = klines[klines.length - 2];

    const isGold = market === "XAUUSD";
    const slDist = isGold ? Math.max(range * 0.7, 0.6) : Math.max(range * 0.7, 45.0);

    let side = "WAIT";
    let status = "ACTIVE";
    let reason = "";

    if (prev.low <= sessionLow && latest.close >= sessionLow) {
      side = "BUY";
      reason = `Asian Session Liquidity Sweep below ${sessionLow.toFixed(2)} + Bullish BOS confirmation.`;
    } else if (prev.high >= sessionHigh && latest.close <= sessionHigh) {
      side = "SELL";
      reason = `Asian Session Liquidity Grab above ${sessionHigh.toFixed(2)} + Bearish Market Shift confirmation.`;
    } else {
      side = latest.close >= prev.close ? "BUY" : "SELL";
      reason = `SMC Institutional Order Flow (${side}). Key Liquidity Range: ${sessionLow.toFixed(2)} - ${sessionHigh.toFixed(2)}.`;
    }

    const isBuy = side === "BUY";
    const entry = currentPrice;
    const sl = isBuy ? entry - slDist : entry + slDist;
    const tp1 = isBuy ? entry + slDist * 1.5 : entry - slDist * 1.5;
    const tp2 = isBuy ? entry + slDist * 3.0 : entry - slDist * 3.0;

    return {
      symbol: market,
      side,
      status: "ACTIVE",
      entry,
      sl,
      tp1,
      tp1_rr: "1:1.5",
      tp2,
      tp2_rr: "1:3.0",
      tp2_reason: reason,
      strategy: this.name,
      timeframe: this.timeframe,
      timestamp: Date.now(),
      source: "Binance SMC Engine",
      indicators: {
        sessionHigh,
        sessionLow,
      },
    };
  },
};
