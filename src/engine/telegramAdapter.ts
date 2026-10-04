/**
 * MASTER AI ANALYSIS - TELEGRAM MINI APP ADAPTER
 * Formats signals for Telegram Bot HTML notifications and WebApp view.
 */

import { SignalOutput } from "./types";

export function formatSignalForTelegramMessage(signal: SignalOutput): string {
  const isWait = signal.status === "WAIT";
  const icon = signal.status === "BUY" ? "🟢 BUY" : signal.status === "SELL" ? "🔴 SELL" : "⏸ WAIT";

  if (isWait) {
    return `
⚡ <b>MASTER AI ANALYSIS</b>
━━━━━━━━━━━━━━━━━━
<b>Pair:</b> #${signal.symbol}
<b>Status:</b> ${icon}
<b>M15 Trend:</b> ${signal.trend}
<b>Setup:</b> ${signal.setup}

<b>Reason:</b>
<i>${signal.reason}</i>

━━━━━━━━━━━━━━━━━━
⏱ <i>${new Date(signal.timestamp).toUTCString()}</i>
`.trim();
  }

  return `
⚡ <b>MASTER AI ANALYSIS — NEW SIGNAL</b>
━━━━━━━━━━━━━━━━━━
<b>Pair:</b> #${signal.symbol}
<b>Action:</b> ${icon}
<b>Trend (M15):</b> ${signal.trend}
<b>Setup (M5):</b> ${signal.setup}

🎯 <b>ENTRY:</b> <code>${signal.entry?.toFixed(2)}</code>
🛑 <b>STOP LOSS:</b> <code>${signal.stopLoss?.toFixed(2)}</code> (Structural)
🚀 <b>TP1 (1R - 50%):</b> <code>${signal.tp1?.toFixed(2)}</code>
🏁 <b>TP2 (2R - 50%):</b> <code>${signal.tp2?.toFixed(2)}</code>

<b>Risk Distance:</b> ${signal.riskDistance}
<b>Risk/Reward:</b> 1:2
<b>Confidence:</b> ${signal.confidenceScore}/100

<b>Trigger Logic:</b>
<i>${signal.reason}</i>

━━━━━━━━━━━━━━━━━━
⏱ <i>${new Date(signal.timestamp).toUTCString()}</i>
`.trim();
}
