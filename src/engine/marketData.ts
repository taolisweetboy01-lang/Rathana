/**
 * MASTER AI ANALYSIS - MARKET DATA INTERFACE
 * Real market data fetcher for M15, M5, and M3 from Binance & Bybit
 * Includes integrity and freshness validation.
 */

import { Candle, SupportedSymbol, Timeframe, MarketDataProvider } from "./types";
import { getSymbolConfig } from "./config";

const TIMEFRAME_MAP: Record<Timeframe, { binance: string; bybit: string; minutes: number }> = {
  M15: { binance: "15m", bybit: "15", minutes: 15 },
  M5: { binance: "5m", bybit: "5", minutes: 5 },
  M3: { binance: "3m", bybit: "3", minutes: 3 },
};

export class RealMarketDataProvider implements MarketDataProvider {
  /**
   * Fetch real OHLCV data for M15, M5, or M3
   */
  async getMarketData(
    symbol: SupportedSymbol,
    timeframe: Timeframe,
    limit: number = 80
  ): Promise<Candle[] | null> {
    const config = getSymbolConfig(symbol);
    const tfMeta = TIMEFRAME_MAP[timeframe];
    if (!tfMeta) return null;

    // 1. For XAUUSD: Fetch from Bybit XAUUSDT (London Spot Gold / OANDA Benchmark)
    // For BTCUSD: Fetch from Binance BTCUSDT
    if (symbol === "XAUUSD") {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=XAUUSDT&interval=${tfMeta.bybit}&limit=${limit}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const list = json?.result?.list;
          if (Array.isArray(list) && list.length >= 10) {
            const parsed = list.slice().reverse().map((k: any) => ({
              time: parseInt(k[0]),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }));

            if (this.validateCandles(parsed, tfMeta.minutes)) {
              return parsed;
            }
          }
        }
      } catch (e) {
        // Fallback
      }
    } else {
      // BTCUSD: Fetch from Binance
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://data-api.binance.vision/api/v3/klines?symbol=${config.feedSymbol}&interval=${tfMeta.binance}&limit=${limit}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const raw = await res.json();
          if (Array.isArray(raw) && raw.length >= 10) {
            const parsed = raw.map((k: any) => ({
              time: Number(k[0]),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }));

            if (this.validateCandles(parsed, tfMeta.minutes)) {
              return parsed;
            }
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    // 2. Secondary Fallback for BTCUSD
    if (symbol === "BTCUSD") {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${tfMeta.bybit}&limit=${limit}`;
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const list = json?.result?.list;
          if (Array.isArray(list) && list.length >= 10) {
            const parsed = list.slice().reverse().map((k: any) => ({
              time: parseInt(k[0]),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }));

            if (this.validateCandles(parsed, tfMeta.minutes)) {
              return parsed;
            }
          }
        }
      } catch (e) {
        // Fallback failed
      }
    }

    return null;
  }

  /**
   * Validates integrity, ordering, and freshness
   */
  private validateCandles(candles: Candle[], tfMinutes: number): boolean {
    if (!candles || candles.length < 10) return false;

    // Check ascending timestamps
    for (let i = 1; i < candles.length; i++) {
      if (candles[i].time <= candles[i - 1].time) return false;
      const c = candles[i];
      if (
        !Number.isFinite(c.open) ||
        !Number.isFinite(c.high) ||
        !Number.isFinite(c.low) ||
        !Number.isFinite(c.close) ||
        c.high < c.low ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close)
      ) {
        return false;
      }
    }

    // Freshness check: latest candle must not be older than 3.5 intervals
    const latest = candles[candles.length - 1];
    const maxAgeMs = tfMinutes * 60 * 1000 * 3.5;
    if (Date.now() - latest.time > maxAgeMs) {
      // Stale data detected
      return false;
    }

    return true;
  }
}
