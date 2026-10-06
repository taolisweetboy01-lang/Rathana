/**
 * MASTER AI ANALYSIS - TRADINGVIEW LIVE REAL-TIME QUOTE PROXY
 * Endpoint: /.netlify/functions/tv-quotes
 * Fetches real-time price quotes directly from TradingView Scanner API
 * Exact 100% price synchronization with TradingView charts.
 */

export async function handler() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2800);

    const res = await fetch("https://scanner.tradingview.com/global/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbols: { tickers: ["OANDA:XAUUSD", "BINANCE:BTCUSDT"] },
        columns: ["close", "change", "open", "high", "low"],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const xau = data?.data?.find((d: any) => d.s === "OANDA:XAUUSD")?.d?.[0];
      const btc = data?.data?.find((d: any) => d.s === "BINANCE:BTCUSDT")?.d?.[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          XAUUSD: xau || null,
          BTCUSD: btc || null,
          source: "TradingView Scanner (Direct Chart Quote)",
          timestamp: Date.now(),
        }),
      };
    }

    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Failed to fetch from TradingView Scanner" }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Proxy error" }),
    };
  }
}
