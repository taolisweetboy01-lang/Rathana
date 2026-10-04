export interface JournalEntry {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  strategyName: string;
  strategyCategory: string;
  entryPrice: number;
  exitPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  outcome: "HIT_TP1" | "HIT_TP2" | "HIT_SL";
  rrGained: number; // e.g. +2.0, +3.0, -1.0
  pips: number;
  dateStr: string; // "03 Oct 2026"
  timeStr: string; // "19:45"
  timestamp: number;
  notes: string;
}

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: "j-001",
    symbol: "XAUUSD",
    side: "BUY",
    strategyName: "Market Structure + Liquidity Sweep + BOS + Retest",
    strategyCategory: "ICT / SMC",
    entryPrice: 2642.5,
    exitPrice: 2672.5,
    sl: 2632.5,
    tp1: 2662.5,
    tp2: 2672.5,
    outcome: "HIT_TP2",
    rrGained: 3.0,
    pips: 300,
    dateStr: "03 Oct 2026",
    timeStr: "18:40",
    timestamp: Date.now() - 4 * 60 * 60 * 1000,
    notes: "H1 Bullish Order block + Asian low sweep. Reached target TP2 cleanly.",
  },
  {
    id: "j-002",
    symbol: "XAUUSD",
    side: "SELL",
    strategyName: "High-Frequency Gold Scalper (Liquidity Grab)",
    strategyCategory: "Scalping",
    entryPrice: 2658.0,
    exitPrice: 2648.0,
    sl: 2663.0,
    tp1: 2648.0,
    tp2: 2643.0,
    outcome: "HIT_TP1",
    rrGained: 2.0,
    pips: 100,
    dateStr: "03 Oct 2026",
    timeStr: "14:15",
    timestamp: Date.now() - 9 * 60 * 60 * 1000,
    notes: "M1 quick liquidity grab rejection in London session. Closed full at TP1.",
  },
  {
    id: "j-003",
    symbol: "BTCUSD",
    side: "BUY",
    strategyName: "Institutional Order Flow + Volume Absorption",
    strategyCategory: "Order Flow",
    entryPrice: 83500,
    exitPrice: 85250,
    sl: 83000,
    tp1: 84500,
    tp2: 85250,
    outcome: "HIT_TP2",
    rrGained: 3.5,
    pips: 1750,
    dateStr: "02 Oct 2026",
    timeStr: "21:10",
    timestamp: Date.now() - 22 * 60 * 60 * 1000,
    notes: "Delta volume spike absorption at daily support.",
  },
  {
    id: "j-004",
    symbol: "XAUUSD",
    side: "BUY",
    strategyName: "ICT Fair Value Gap (FVG) + Displacement",
    strategyCategory: "ICT / SMC",
    entryPrice: 2660.0,
    exitPrice: 2652.0,
    sl: 2652.0,
    tp1: 2676.0,
    tp2: 2684.0,
    outcome: "HIT_SL",
    rrGained: -1.0,
    pips: -80,
    dateStr: "02 Oct 2026",
    timeStr: "19:35",
    timestamp: Date.now() - 25 * 60 * 60 * 1000,
    notes: "Hit SL during high-impact US news spike. Managed risk strictly at 1R.",
  },
  {
    id: "j-005",
    symbol: "XAUUSD",
    side: "SELL",
    strategyName: "Market Structure + Liquidity Sweep + BOS + Retest",
    strategyCategory: "ICT / SMC",
    entryPrice: 2675.2,
    exitPrice: 2645.2,
    sl: 2685.2,
    tp1: 2655.2,
    tp2: 2645.2,
    outcome: "HIT_TP2",
    rrGained: 3.0,
    pips: 300,
    dateStr: "01 Oct 2026",
    timeStr: "16:20",
    timestamp: Date.now() - 44 * 60 * 60 * 1000,
    notes: "Clean M5 Bearish BOS after sweeping London High liquidity.",
  },
];
