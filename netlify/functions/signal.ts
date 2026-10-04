/**
 * MASTER AI ANALYSIS - NETLIFY SERVERLESS FUNCTION
 * Endpoint: /.netlify/functions/signal?symbol=XAUUSD (or BTCUSD)
 * Compatible with Netlify Functions, Vercel, and Telegram Mini Apps.
 */

import { runMultiTimeframeEngine } from "../../src/engine/analysisEngine";
import { SupportedSymbol } from "../../src/engine/types";

interface HandlerEvent {
  queryStringParameters?: Record<string, string | undefined>;
  httpMethod: string;
}

export async function handler(event: HandlerEvent) {
  // CORS Headers for Telegram Mini App and Web clients
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const rawSymbol = event.queryStringParameters?.symbol?.toUpperCase() || "XAUUSD";
    const symbol: SupportedSymbol = rawSymbol === "BTCUSD" ? "BTCUSD" : "XAUUSD";
    const debug = event.queryStringParameters?.debug === "true";

    const signal = await runMultiTimeframeEngine(symbol, { debug });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(signal, null, 2),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: "WAIT",
        error: error.message || "Internal analysis engine failure",
        timestamp: Date.now(),
      }),
    };
  }
}
