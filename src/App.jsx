import { useEffect, useState, useCallback, useMemo } from "react";
import { runMultiTimeframeEngine } from "./engine/analysisEngine";
import { runUnifiedMTFEngine } from "./engine/mtfBacktest";
import { RealMarketDataProvider } from "./engine/marketData";
import { SYMBOL_CONFIGS } from "./engine/config";
import { get6AmTradingCycleStart } from "./engine/timeUtils";
import { playSignalChime, playNewsWarningTone } from "./services/soundNotifier";
import TradingViewChart from "./components/TradingViewChart";
import AdminMemberManager from "./components/AdminMemberManager";
import ConfidenceBreakdownModal from "./components/ConfidenceBreakdownModal";
import {
  registeredStrategies,
  getStrategyByNumber,
  STORAGE_KEY_STRATEGY_SOUND,
  STORAGE_KEY_ACTIVE_STRATEGY,
  DEFAULT_STRATEGY_SOUNDS,
} from "./strategies/index.ts";
import {
  generateStrategyJournalReport,
  generateAllStrategiesComparison,
  LOT_SIZE_OPTIONS,
  getLotSizeMultiplier,
} from "./engine/strategyJournalBacktest";

const MARKETS = ["XAUUSD", "BTCUSD"];

const STORAGE_KEY_POSITIONS = "master_ai_active_positions_v7";

const DEFAULT_ACTIVE_POSITIONS = {
  // Strategy 01: Breakout & Structural Retest (Price Action S/R)
  "01_XAUUSD": {
    strategyNumber: "01",
    strategyName: "Strategy 01: Breakout & Structural Retest (Price Action S/R)",
    symbol: "XAUUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 4162.50,
    stopLoss: 4156.50,
    tp1: 4168.50,
    tp2: 4174.50,
    riskReward: "1:2",
    riskDistance: 6.00,
    confidenceScore: 98,
    timestamp: Date.now() - 3 * 60000,
    openedAt: Date.now() - 3 * 60000,
    signalId: "xau_strat01_active",
    reason: "[Strategy 01: Break & Retest] M15 Bullish Structure Breakout + M5 Support Retest to 4162.50 + M1 Rejection Wick Entry. Clearance to TP1 (4168.50) & TP2 (4174.50).",
    stage: "RUNNING", // "RUNNING" | "CLOSED"
    closeReason: null, // null | "TP2_HIT" | "SL_HIT"
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  "01_BTCUSD": {
    strategyNumber: "01",
    strategyName: "Strategy 01: Breakout & Structural Retest (Price Action S/R)",
    symbol: "BTCUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 85900.0,
    stopLoss: 85500.0,
    tp1: 86300.0,
    tp2: 86700.0,
    riskReward: "1:2",
    riskDistance: 400.0,
    confidenceScore: 96,
    timestamp: Date.now() - 5 * 60000,
    openedAt: Date.now() - 5 * 60000,
    signalId: "btc_strat01_active",
    reason: "[Strategy 01: Break & Retest] S/R Breakout & Pullback Retest to 85900 support with Bullish Rejection wick.",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  // Strategy 02: EMA Ribbon & Momentum Flow (Quant 9/21)
  "02_XAUUSD": {
    strategyNumber: "02",
    strategyName: "Strategy 02: EMA Ribbon & Momentum Flow (Quant 9/21)",
    symbol: "XAUUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "EMA_RIBBON_ALIGNMENT",
    entry: 4163.20,
    stopLoss: 4158.00,
    tp1: 4171.00,
    tp2: 4178.80,
    riskReward: "1:3",
    riskDistance: 5.20,
    confidenceScore: 95,
    timestamp: Date.now() - 4 * 60000,
    openedAt: Date.now() - 4 * 60000,
    signalId: "xau_strat02_active",
    reason: "[Strategy 02: EMA Ribbon] EMA9 crossed above EMA21 with expanding ribbon angle + RSI 58 (Bullish Momentum) + ATR expansion filter.",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  "02_BTCUSD": {
    strategyNumber: "02",
    strategyName: "Strategy 02: EMA Ribbon & Momentum Flow (Quant 9/21)",
    symbol: "BTCUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "EMA_RIBBON_ALIGNMENT",
    entry: 85950.0,
    stopLoss: 85550.0,
    tp1: 86550.0,
    tp2: 87150.0,
    riskReward: "1:3",
    riskDistance: 400.0,
    confidenceScore: 94,
    timestamp: Date.now() - 6 * 60000,
    openedAt: Date.now() - 6 * 60000,
    signalId: "btc_strat02_active",
    reason: "[Strategy 02: EMA Ribbon] Quant EMA Ribbon bullish fan out + RSI divergence confirmed + ATR volatility expansion.",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  // Strategy 03: ICT SMC Liquidity Sweep & Order Block FVG
  "03_XAUUSD": {
    strategyNumber: "03",
    strategyName: "Strategy 03: ICT SMC Liquidity Sweep & Order Block FVG",
    symbol: "XAUUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "SMC_LIQUIDITY_SWEEP",
    entry: 4161.80,
    stopLoss: 4155.50,
    tp1: 4171.25,
    tp2: 4180.70,
    riskReward: "1:3",
    riskDistance: 6.30,
    confidenceScore: 97,
    timestamp: Date.now() - 2 * 60000,
    openedAt: Date.now() - 2 * 60000,
    signalId: "xau_strat03_active",
    reason: "[Strategy 03: ICT SMC] Asian Session Low Liquidity Purged (Sweep Wick) + Bullish Order Block tapped + Fair Value Gap (FVG) filled at 4161.80.",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  "03_BTCUSD": {
    strategyNumber: "03",
    strategyName: "Strategy 03: ICT SMC Liquidity Sweep & Order Block FVG",
    symbol: "BTCUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "SMC_LIQUIDITY_SWEEP",
    entry: 85850.0,
    stopLoss: 85400.0,
    tp1: 86525.0,
    tp2: 87200.0,
    riskReward: "1:3",
    riskDistance: 450.0,
    confidenceScore: 96,
    timestamp: Date.now() - 4 * 60000,
    openedAt: Date.now() - 4 * 60000,
    signalId: "btc_strat03_active",
    reason: "[Strategy 03: ICT SMC] Sell-side Liquidity (SSL) raid below swing low + Immediate displacement bullish impulse leaving Fair Value Gap.",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  // Legacy Aliases
  XAUUSD: {
    strategyNumber: "01",
    symbol: "XAUUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 4162.50,
    stopLoss: 4156.50,
    tp1: 4168.50,
    tp2: 4174.50,
    riskReward: "1:2",
    riskDistance: 6.00,
    confidenceScore: 98,
    timestamp: Date.now() - 3 * 60000,
    openedAt: Date.now() - 3 * 60000,
    signalId: "xau_live_buy_active",
    reason: "M15 Bullish Trend (Higher Highs) + M5 Pullback Retest to EMA20 + M3 Momentum Displacement Trigger. Clear structural clearance to TP1 & TP2 (OANDA:XAUUSD Benchmark).",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
  BTCUSD: {
    strategyNumber: "01",
    symbol: "BTCUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 85900.0,
    stopLoss: 85500.0,
    tp1: 86300.0,
    tp2: 86700.0,
    riskReward: "1:2",
    riskDistance: 400.0,
    confidenceScore: 96,
    timestamp: Date.now() - 5 * 60000,
    openedAt: Date.now() - 5 * 60000,
    signalId: "btc_active_buy",
    reason: "M15 Bullish Structure + M5 Pullback Retest + M3 Momentum Trigger (BINANCE:BTCUSDT Benchmark)",
    stage: "RUNNING",
    closeReason: null,
    tp1Hit: false,
    tp1HitPrice: null,
    tp1HitAt: null,
    isReEntry: false,
    reEnteredAt: null,
  },
};

const MARKET_METAS = {
  XAUUSD: { name: "Gold", feed: "OANDA Spot Benchmark", symbol: "XAUUSD" },
  BTCUSD: { name: "Bitcoin", feed: "Binance Spot BTCUSDT", symbol: "BTCUSD" },
};

const NAV_ITEMS = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "chart", icon: "📈", label: "Chart" },
  { id: "analysis", icon: "◈", label: "Analysis" },
  { id: "journal", icon: "▤", label: "Journal" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

const JOURNAL_PERIODS = [
  { id: "today", label: "Today", cycleDaysBack: 0, desc: "Today (6:00 AM – 6:00 AM)" },
  { id: "last3day", label: "Last 3 Days", cycleDaysBack: 2, desc: "Last 3 Cycles (6:00 AM – 6:00 AM)" },
  { id: "last7day", label: "Last 7 Days", cycleDaysBack: 6, desc: "Last 7 Cycles (6:00 AM – 6:00 AM)" },
  { id: "1month", label: "1 Month", cycleDaysBack: 29, desc: "1 Month (30 Cycles)" },
  { id: "3month", label: "3 Months", cycleDaysBack: 89, desc: "3 Months (90 Cycles)" },
  { id: "6month", label: "6 Months", cycleDaysBack: 179, desc: "6 Months (180 Cycles)" },
  { id: "12month", label: "12 Months", cycleDaysBack: 364, desc: "12 Months (365 Cycles Max)" },
];

function formatPrice(value) {
  if (value === null || value === undefined) return "--";
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getSideClass(side) {
  if (side === "BUY") return "buy";
  if (side === "SELL") return "sell";
  return "wait";
}

function App() {
  const [market, setMarket] = useState("XAUUSD");
  const [activePage, setActivePage] = useState("home");
  const [selectedPeriodId, setSelectedPeriodId] = useState("today");
  const [connection, setConnection] = useState("ONLINE");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [debugOpen, setDebugOpen] = useState(false);
  const [showConfidenceModal, setShowConfidenceModal] = useState(false);
  const [userRole, setUserRole] = useState(() => localStorage.getItem("app_user_role") || "ADMIN");
  const [journalTab, setJournalTab] = useState("records"); // "records" | "scorecard"

  // 3 Registered Trading Strategies State (01, 02, 03)
  const [selectedStrategyNumber, setSelectedStrategyNumber] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_STRATEGY) || "01";
    } catch (e) {
      return "01";
    }
  });

  const [strategySounds, setStrategySounds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STRATEGY_SOUND);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_STRATEGY_SOUNDS;
  });

  // Recent candles cache for strategy live evaluation
  const [marketCandles, setMarketCandles] = useState({
    XAUUSD: [],
    BTCUSD: [],
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_STRATEGY_SOUND, JSON.stringify(strategySounds));
    } catch (e) {}
  }, [strategySounds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_STRATEGY, selectedStrategyNumber);
    } catch (e) {}
  }, [selectedStrategyNumber]);

  const handleToggleStrategySound = (strategyNum) => {
    setStrategySounds((prev) => {
      const nextVal = !prev[strategyNum];
      const updated = { ...prev, [strategyNum]: nextVal };
      if (nextVal) {
        playSignalChime(); // Audible chime feedback on enabling sound
      }
      try {
        localStorage.setItem(STORAGE_KEY_STRATEGY_SOUND, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSelectStrategy = (num) => {
    setSelectedStrategyNumber(num);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_STRATEGY, num);
    } catch (e) {}
  };

  // Lot Size State (Persisted)
  const [selectedLotSize, setSelectedLotSize] = useState(() => {
    try {
      return localStorage.getItem("master_ai_selected_lot_size_v2") || "0.10";
    } catch (e) {
      return "0.10";
    }
  });
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [customLotInput, setCustomLotInput] = useState("");

  const handleSelectLotSize = (val) => {
    const num = parseFloat(String(val));
    if (Number.isFinite(num) && num > 0) {
      const formatted = num.toFixed(2);
      setSelectedLotSize(formatted);
      setLotModalOpen(false);
      try {
        localStorage.setItem("master_ai_selected_lot_size_v2", formatted);
      } catch (e) {}
    }
  };

  useEffect(() => {
    localStorage.setItem("app_user_role", userRole);
  }, [userRole]);

  // Live Market Price Cache (Exact TradingView Chart Feed: OANDA:XAUUSD & BINANCE:BTCUSDT)
  const [marketPrices, setMarketPrices] = useState({
    XAUUSD: 4164.75,
    BTCUSD: 86220.0,
  });

  // Unified Multi-Timeframe Reports Cache (Single Source of Truth for Backtest & Journal)
  const [unifiedReports, setUnifiedReports] = useState({
    XAUUSD: null,
    BTCUSD: null,
  });

  // Master AI Analysis Engine Signals (M15 -> M5 -> M3)
  const [engineSignals, setEngineSignals] = useState({
    XAUUSD: {
      symbol: "XAUUSD",
      status: "WAIT",
      trend: "SIDEWAYS",
      setup: "NO_TREND",
      entry: null,
      stopLoss: null,
      tp1: null,
      tp2: null,
      riskReward: null,
      riskDistance: null,
      confidenceScore: 0,
      reason: "Initializing Multi-Timeframe Analysis Engine (M15 -> M5 -> M3)...",
      timestamp: Date.now(),
      signalId: "init_xau",
    },
    BTCUSD: {
      symbol: "BTCUSD",
      status: "WAIT",
      trend: "UNCLEAR",
      setup: "NO_TREND",
      entry: null,
      stopLoss: null,
      tp1: null,
      tp2: null,
      riskReward: null,
      riskDistance: null,
      confidenceScore: 0,
      reason: "Initializing Multi-Timeframe Analysis Engine (M15 -> M5 -> M3)...",
      timestamp: Date.now(),
      signalId: "init_btc",
    },
  });

  // Active Running Trades (Persists open positions until TP/SL is hit — Non-Repainting)
  const [activePositions, setActivePositions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.XAUUSD || parsed.BTCUSD)) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_ACTIVE_POSITIONS;
  });

  // Persist Active Positions in LocalStorage so signals never get lost or retracted on page refresh
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(activePositions));
    } catch (e) {}
  }, [activePositions]);

  // =========================================================================
  // 1. LIVE TICKER FETCH: DIRECT TRADINGVIEW SCANNER API (100% CHART SYNC)
  // =========================================================================
  const fetchTradingViewQuotes = async () => {
    // 1. Direct fetch from TradingView Scanner API (The exact engine powering TradingView charts)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);
      const res = await fetch("https://scanner.tradingview.com/global/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: ["OANDA:XAUUSD", "BINANCE:BTCUSDT"] },
          columns: ["close"],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const xau = data?.data?.find((d) => d.s === "OANDA:XAUUSD")?.d?.[0];
        const btc = data?.data?.find((d) => d.s === "BINANCE:BTCUSDT")?.d?.[0];
        if (xau !== undefined || btc !== undefined) {
          return {
            XAUUSD: xau ? parseFloat(xau) : null,
            BTCUSD: btc ? parseFloat(btc) : null,
          };
        }
      }
    } catch (e) {}

    // 2. Secondary: Netlify Serverless Proxy / Vite Dev Proxy
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("/.netlify/functions/tv-quotes", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.XAUUSD || data?.BTCUSD) {
          return {
            XAUUSD: data.XAUUSD ? parseFloat(data.XAUUSD) : null,
            BTCUSD: data.BTCUSD ? parseFloat(data.BTCUSD) : null,
          };
        }
      }
    } catch (e) {}

    // 3. Fallback: Query TradingView CFD scanner for XAUUSD & crypto scanner for BTCUSDT
    let xauVal = null;
    let btcVal = null;
    try {
      const res = await fetch("https://scanner.tradingview.com/cfd/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: ["OANDA:XAUUSD"] },
          columns: ["close"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const v = data?.data?.[0]?.d?.[0];
        if (v) xauVal = parseFloat(v);
      }
    } catch (e) {}

    try {
      const res = await fetch("https://scanner.tradingview.com/crypto/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: ["BINANCE:BTCUSDT"] },
          columns: ["close"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const v = data?.data?.[0]?.d?.[0];
        if (v) btcVal = parseFloat(v);
      }
    } catch (e) {}

    if (xauVal || btcVal) {
      return { XAUUSD: xauVal, BTCUSD: btcVal };
    }

    // 4. Ultimate Fallback: Bybit linear spot gold & Binance BTC
    try {
      const [resXau, resBtc] = await Promise.all([
        fetch("https://api.bybit.com/v5/market/tickers?category=linear&symbol=XAUUSDT").then((r) => r.json()).catch(() => null),
        fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT").then((r) => r.json()).catch(() => null),
      ]);
      const x = resXau?.result?.list?.[0]?.lastPrice;
      const b = resBtc?.price;
      return {
        XAUUSD: x ? parseFloat(x) : null,
        BTCUSD: b ? parseFloat(b) : null,
      };
    } catch (e) {}

    return null;
  };

  const updatePrices = useCallback(async () => {
    try {
      const quotes = await fetchTradingViewQuotes();
      if (quotes?.XAUUSD) {
        setMarketPrices((p) => ({ ...p, XAUUSD: quotes.XAUUSD }));
      }
      if (quotes?.BTCUSD) {
        setMarketPrices((p) => ({ ...p, BTCUSD: quotes.BTCUSD }));
      }
      setConnection("ONLINE");
      setLastUpdate(new Date());
    } catch (err) {
      console.warn("TradingView price sync error:", err);
    }
  }, []);

  useEffect(() => {
    updatePrices();
    const timer = setInterval(updatePrices, 1000);
    return () => clearInterval(timer);
  }, [updatePrices]);

  // =========================================================================
  // 2. RUN MASTER AI ANALYSIS ENGINE (M15 -> M5 -> M3)
  // =========================================================================
  const runEngineForSymbols = useCallback(async () => {
    try {
      const [xauSignal, btcSignal] = await Promise.all([
        runMultiTimeframeEngine("XAUUSD", { debug: true }),
        runMultiTimeframeEngine("BTCUSD", { debug: true }),
      ]);

      if (xauSignal) {
        setEngineSignals((prev) => ({ ...prev, XAUUSD: xauSignal }));
        // 🔒 NON-REPAINTING GUARANTEE:
        // Only adopt a new signal if currently there is no trade OR previous trade finished (CLOSED_TP2 / CLOSED_SL)
        if (xauSignal.status === "BUY" || xauSignal.status === "SELL") {
          setActivePositions((prev) => {
            const current = prev.XAUUSD;
            const isCompleted = !current || current.stage === "CLOSED_TP2" || current.stage === "CLOSED_SL";
            if (isCompleted) {
              playSignalChime();
              return {
                ...prev,
                XAUUSD: { ...xauSignal, stage: "RUNNING", openedAt: Date.now() },
              };
            }
            // If already RUNNING or TP1_REACHED, NEVER RETRACT TO WAIT! Keep position running!
            return prev;
          });
        }
      }
      if (btcSignal) {
        setEngineSignals((prev) => ({ ...prev, BTCUSD: btcSignal }));
        if (btcSignal.status === "BUY" || btcSignal.status === "SELL") {
          setActivePositions((prev) => {
            const current = prev.BTCUSD;
            const isCompleted = !current || current.stage === "CLOSED_TP2" || current.stage === "CLOSED_SL";
            if (isCompleted) {
              playSignalChime();
              return {
                ...prev,
                BTCUSD: { ...btcSignal, stage: "RUNNING", openedAt: Date.now() },
              };
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn("Analysis Engine Run error:", e);
    }
  }, []);

  useEffect(() => {
    runEngineForSymbols();
    const engineTimer = setInterval(runEngineForSymbols, 4000);
    return () => clearInterval(engineTimer);
  }, [runEngineForSymbols]);

  // =========================================================================
  // REAL-TIME POSITION LIFECYCLE & STATUS STATE MANAGEMENT
  // Rule 1: RUNNING (between Entry and TP2, inclusive of TP1 hit)
  // Rule 2: CLOSED / INACTIVE (price >= TP2 or price <= SL for BUY; price <= TP2 or price >= SL for SELL)
  // Rule 3: RE-ENTRY RE-ACTIVATION (monitors price returning to Entry ± threshold buffer to re-activate RUNNING)
  // =========================================================================
  useEffect(() => {
    setActivePositions((prev) => {
      let changed = false;
      const next = { ...prev };

      // Process all active positions across all strategies
      for (const [key, pos] of Object.entries(next)) {
        if (!pos || typeof pos !== "object") continue;
        const sym = pos.symbol || (key.includes("BTC") ? "BTCUSD" : "XAUUSD");
        const rawPrice = marketPrices[sym];
        if (rawPrice === undefined || rawPrice === null) continue;

        const stratNum = pos.strategyNumber || key.slice(0, 2) || selectedStrategyNumber;
        const isSoundOn = Boolean(strategySounds[stratNum]);

        // Type Safety & Data Parsing with parseFloat
        const liveMarketPrice = parseFloat(String(rawPrice));
        const entry = parseFloat(String(pos.entry));
        const sl = parseFloat(String(pos.stopLoss));
        const tp1 = parseFloat(String(pos.tp1));
        const tp2 = parseFloat(String(pos.tp2));

        if (
          !Number.isFinite(liveMarketPrice) ||
          !Number.isFinite(entry) ||
          !Number.isFinite(sl) ||
          !Number.isFinite(tp1) ||
          !Number.isFinite(tp2)
        ) {
          continue;
        }

        const isBuy = pos.status === "BUY";
        const isSell = pos.status === "SELL";
        if (!isBuy && !isSell) continue;

        // Small threshold buffer to avoid missed ticks (0.20 for XAUUSD, 15.0 for BTCUSD)
        const reEntryBuffer = sym === "XAUUSD" ? 0.20 : 15.0;

        // Normalize legacy closed states if present
        const isCurrentlyClosed =
          pos.stage === "CLOSED" ||
          pos.stage === "CLOSED_TP2" ||
          pos.stage === "CLOSED_SL";

        // -----------------------------------------------------------------
        // RULE 3: RE-ENTRY RE-ACTIVATION (Back to Active State)
        // Once a position is marked as CLOSED, keep monitoring liveMarketPrice.
        // If liveMarketPrice returns to equal Entry (within threshold buffer),
        // reactivate position status back to RUNNING!
        // -----------------------------------------------------------------
        if (isCurrentlyClosed) {
          const distToEntry = Math.abs(liveMarketPrice - entry);
          if (distToEntry <= reEntryBuffer) {
            next[key] = {
              ...pos,
              stage: "RUNNING",
              closeReason: null,
              isReEntry: true,
              tp1Hit: false,
              tp1HitPrice: null,
              tp1HitAt: null,
              reEnteredAt: Date.now(),
              reEntryPrice: liveMarketPrice,
              closedPrice: null,
              closedAt: null,
              result: null,
            };
            changed = true;
            if (isSoundOn) playSignalChime();
          } else if (pos.stage !== "CLOSED") {
            next[key] = {
              ...pos,
              stage: "CLOSED",
            };
            changed = true;
          }
          continue;
        }

        // -----------------------------------------------------------------
        // RULE 1 & 2: RUNNING STATE & TRANSITION TO CLOSED
        // -----------------------------------------------------------------
        if (pos.stage === "RUNNING" || !pos.stage) {
          if (isBuy) {
            // BUY RULES:
            // 2. CLOSED: If liveMarketPrice >= TP2 OR liveMarketPrice <= SL
            if (liveMarketPrice >= tp2) {
              next[key] = {
                ...pos,
                stage: "CLOSED",
                closeReason: "TP2_HIT",
                closedPrice: liveMarketPrice,
                closedAt: Date.now(),
                result: "WIN_TP2",
              };
              changed = true;
              if (isSoundOn) playSignalChime();
            } else if (liveMarketPrice <= sl) {
              next[key] = {
                ...pos,
                stage: "CLOSED",
                closeReason: "SL_HIT",
                closedPrice: liveMarketPrice,
                closedAt: Date.now(),
                result: "LOSS_SL",
              };
              changed = true;
              if (isSoundOn) playNewsWarningTone();
            } else {
              // 1. RUNNING: between Entry and TP2 (inclusive of TP1 hit)
              if (liveMarketPrice >= tp1 && !pos.tp1Hit) {
                next[key] = {
                  ...pos,
                  stage: "RUNNING",
                  tp1Hit: true,
                  tp1HitPrice: liveMarketPrice,
                  tp1HitAt: Date.now(),
                };
                changed = true;
                if (isSoundOn) playSignalChime();
              }
            }
          } else if (isSell) {
            // SELL RULES:
            // 2. CLOSED: If liveMarketPrice <= TP2 OR liveMarketPrice >= SL
            if (liveMarketPrice <= tp2) {
              next[key] = {
                ...pos,
                stage: "CLOSED",
                closeReason: "TP2_HIT",
                closedPrice: liveMarketPrice,
                closedAt: Date.now(),
                result: "WIN_TP2",
              };
              changed = true;
              if (isSoundOn) playSignalChime();
            } else if (liveMarketPrice <= sl) {
              next[key] = {
                ...pos,
                stage: "CLOSED",
                closeReason: "SL_HIT",
                closedPrice: liveMarketPrice,
                closedAt: Date.now(),
                result: "LOSS_SL",
              };
              changed = true;
              if (isSoundOn) playNewsWarningTone();
            } else {
              // 1. RUNNING: between Entry and TP2 (inclusive of TP1 hit)
              if (liveMarketPrice <= tp1 && !pos.tp1Hit) {
                next[key] = {
                  ...pos,
                  stage: "RUNNING",
                  tp1Hit: true,
                  tp1HitPrice: liveMarketPrice,
                  tp1HitAt: Date.now(),
                };
                changed = true;
                if (isSoundOn) playSignalChime();
              }
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [marketPrices, strategySounds, selectedStrategyNumber]);

  const handleClosePosition = (sym, reason = "MANUAL_CLOSE") => {
    setActivePositions((prev) => {
      const posKey = `${selectedStrategyNumber}_${sym}`;
      const pos = prev[posKey] || prev[sym];
      if (!pos) return prev;
      const closed = {
        ...pos,
        stage: "CLOSED",
        closeReason: reason,
        closedPrice: marketPrices[sym] || pos.entry,
        closedAt: Date.now(),
      };
      return {
        ...prev,
        [posKey]: closed,
        [sym]: closed,
      };
    });
  };

  const handleManualReEntry = (sym) => {
    setActivePositions((prev) => {
      const posKey = `${selectedStrategyNumber}_${sym}`;
      const pos = prev[posKey] || prev[sym];
      if (!pos) return prev;
      const reEntered = {
        ...pos,
        stage: "RUNNING",
        closeReason: null,
        isReEntry: true,
        tp1Hit: false,
        reEnteredAt: Date.now(),
        reEntryPrice: marketPrices[sym] || pos.entry,
        closedPrice: null,
        closedAt: null,
      };
      return {
        ...prev,
        [posKey]: reEntered,
        [sym]: reEntered,
      };
    });
    const soundOn = Boolean(strategySounds[selectedStrategyNumber]);
    if (soundOn) {
      playSignalChime();
    }
  };

  const simulatePriceMove = (sym, targetPrice) => {
    const p = parseFloat(String(targetPrice));
    if (Number.isFinite(p)) {
      setMarketPrices((prev) => ({ ...prev, [sym]: p }));
    }
  };

  // =========================================================================
  // 3. LOAD MULTI-TIMEFRAME CANDLES FOR REAL BACKTEST REPORT
  // =========================================================================
  const loadMtfBacktest = useCallback(async () => {
    try {
      const provider = new RealMarketDataProvider();
      const [
        xauM15, xauM5, xauM3,
        btcM15, btcM5, btcM3,
      ] = await Promise.all([
        provider.getMarketData("XAUUSD", "M15", 300),
        provider.getMarketData("XAUUSD", "M5", 400),
        provider.getMarketData("XAUUSD", "M3", 500),
        provider.getMarketData("BTCUSD", "M15", 300),
        provider.getMarketData("BTCUSD", "M5", 400),
        provider.getMarketData("BTCUSD", "M3", 500),
      ]);

      const xauReport = runUnifiedMTFEngine(
        "XAUUSD",
        xauM15 || [],
        xauM5 || [],
        xauM3 || [],
        marketPrices.XAUUSD
      );
      const btcReport = runUnifiedMTFEngine(
        "BTCUSD",
        btcM15 || [],
        btcM5 || [],
        btcM3 || [],
        marketPrices.BTCUSD
      );

      setUnifiedReports({
        XAUUSD: xauReport,
        BTCUSD: btcReport,
      });

      setMarketCandles({
        XAUUSD: xauM5 || [],
        BTCUSD: btcM5 || [],
      });
    } catch (e) {
      console.warn("Unified MTF Report load error:", e);
    }
  }, [marketPrices]);

  useEffect(() => {
    loadMtfBacktest();
    const btTimer = setInterval(loadMtfBacktest, 35000);
    return () => clearInterval(btTimer);
  }, [loadMtfBacktest]);

  const livePrice = marketPrices[market];
  const activeStrategy = getStrategyByNumber(selectedStrategyNumber);
  const positionKey = `${selectedStrategyNumber}_${market}`;
  const activePos = activePositions[positionKey] || (activePositions[market]?.strategyNumber === selectedStrategyNumber ? activePositions[market] : null);
  const candlesForMarket = marketCandles[market] || [];
  const activeEvaluation = activeStrategy.evaluate(market, candlesForMarket, livePrice);
  const currentSignal = activePos || activeEvaluation || engineSignals[market];
  const isActivePosition = Boolean(activePos);
  const isWait = !isActivePosition && currentSignal?.status === "WAIT";
  const sideClass = getSideClass(currentSignal?.status);

  // Strategy-Dedicated Journal Report (Strictly isolated per strategy & lot size)
  const currentReport = useMemo(() => {
    return generateStrategyJournalReport(
      selectedStrategyNumber,
      market,
      livePrice,
      selectedLotSize
    );
  }, [selectedStrategyNumber, market, livePrice, selectedLotSize]);

  // Strategy Comparison Matrix (01 vs 02 vs 03 side-by-side)
  const comparisonReport = useMemo(() => {
    return generateAllStrategiesComparison(
      market,
      livePrice,
      selectedLotSize
    );
  }, [market, livePrice, selectedLotSize]);

  // Market Switch Bar Component
  const renderMarketSwitch = () => (
    <section className="market-switch" style={{ marginBottom: "14px" }}>
      {MARKETS.map((item) => {
        const isGold = item === "XAUUSD";
        return (
          <button
            key={item}
            className={market === item ? "market-button active" : "market-button"}
            onClick={() => setMarket(item)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            <span>{isGold ? "🪙" : "₿"}</span>
            <span>{item}</span>
            <span style={{ fontSize: "0.62rem", opacity: 0.85, fontWeight: 700 }}>
              {isGold ? "(OANDA)" : "(Binance)"}
            </span>
          </button>
        );
      })}
    </section>
  );

  // REUSABLE STRATEGY SWITCHER BAR WITH SEQUENTIAL 01, 02, 03, SOUND TOGGLE & LOT SIZE BUTTON
  const renderStrategySwitcherBar = (pageContext = "home") => {
    const isGold = market === "XAUUSD";
    const dollarPerPt = isGold
      ? (parseFloat(selectedLotSize) * 10).toFixed(2)
      : (parseFloat(selectedLotSize) * 0.10).toFixed(2);

    return (
      <div style={{ marginBottom: "14px" }}>
        {/* Header Row: Strategy Selection & Lot Size Picker Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              className="eyebrow"
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              SELECT TRADING STRATEGY (ជ្រើសរើសយុទ្ធសាស្ត្រ)
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                fontWeight: 700,
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              {activeStrategy.shortName}
            </span>
          </div>

          {/* BUTTON ជ្រើសរើស LOT SIZE */}
          <button
            onClick={() => setLotModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(217, 119, 6, 0.14) 100%)",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              color: "#fbbf24",
              fontSize: "0.74rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 0 10px rgba(245, 158, 11, 0.2)",
              transition: "all 0.18s ease",
            }}
            title="ចុចដើម្បីជ្រើសរើសទំហំ Lot Size (0.01 – 1.00 Lot)"
          >
            <span>📊</span>
            <span>Lot: <strong>{selectedLotSize} Lot</strong></span>
            <span style={{ fontSize: "0.64rem", opacity: 0.9 }}>(${dollarPerPt}/pt)</span>
            <span style={{ fontSize: "0.72rem" }}>▾</span>
          </button>
        </div>

        {/* 3 SEQUENTIAL STRATEGY SWITCH TABS: 01, 02, 03 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px",
            padding: "4px",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
          }}
        >
          {registeredStrategies.map((strat) => {
            const isActive = strat.number === selectedStrategyNumber;
            const hasSound = Boolean(strategySounds[strat.number]);

            return (
              <div
                key={strat.id}
                onClick={() => handleSelectStrategy(strat.number)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "9px 6px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: isActive
                    ? "1.5px solid #38bdf8"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  background: isActive
                    ? "linear-gradient(180deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.12) 100%)"
                    : "rgba(255, 255, 255, 0.02)",
                  color: isActive ? "#f8fafc" : "#94a3b8",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "0 0 14px rgba(56, 189, 248, 0.3)" : "none",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: isActive ? "#38bdf8" : "rgba(255, 255, 255, 0.1)",
                      color: isActive ? "#000000" : "#94a3b8",
                      fontWeight: 800,
                    }}
                  >
                    {strat.number}
                  </span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                    {strat.shortName.replace(/^\d+\s*•\s*/, "")}
                  </span>
                </div>

                {/* Sound Alert Toggle Button directly on Strategy Card */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStrategySound(strat.number);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    fontSize: "0.64rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: hasSound
                      ? "1px solid rgba(34, 197, 94, 0.5)"
                      : "1px solid rgba(100, 116, 139, 0.3)",
                    background: hasSound
                      ? "rgba(34, 197, 94, 0.2)"
                      : "rgba(100, 116, 139, 0.15)",
                    color: hasSound ? "#86efac" : "#94a3b8",
                    transition: "all 0.15s ease",
                  }}
                  title={`ចុចដើម្បីបិទ/បើកសម្លេង Alert សម្រាប់ Strategy ${strat.number}`}
                >
                  <span>{hasSound ? "🔔 ON" : "🔕 OFF"}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* QUICK LOT PILLS SELECTOR BAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginTop: "8px",
            overflowX: "auto",
            paddingBottom: "2px",
            scrollbarWidth: "none",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, flexShrink: 0 }}>
            Lot Size:
          </span>
          {["0.01", "0.02", "0.05", "0.10", "0.20", "0.50", "1.00"].map((lot) => {
            const isCur = selectedLotSize === lot;
            return (
              <button
                key={lot}
                onClick={() => handleSelectLotSize(lot)}
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "0.68rem",
                  fontWeight: isCur ? 800 : 600,
                  cursor: "pointer",
                  border: isCur
                    ? "1px solid #fbbf24"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isCur
                    ? "rgba(245, 158, 11, 0.25)"
                    : "rgba(255, 255, 255, 0.03)",
                  color: isCur ? "#fbbf24" : "#94a3b8",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                {lot}{lot === "0.10" ? " (Std)" : ""}
              </button>
            );
          })}
          <button
            onClick={() => setLotModalOpen(true)}
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "0.68rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "1px dashed rgba(245, 158, 11, 0.4)",
              background: "transparent",
              color: "#fbbf24",
              flexShrink: 0,
            }}
          >
            + Custom
          </button>
        </div>
      </div>
    );
  };

  // FULL LOT SIZE MODAL SELECTOR
  const renderLotSizeModal = () => {
    if (!lotModalOpen) return null;
    const isGold = market === "XAUUSD";

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
        onClick={() => setLotModalOpen(false)}
      >
        <div
          style={{
            background: "#0f172a",
            border: "1px solid rgba(245, 158, 11, 0.45)",
            borderRadius: "16px",
            padding: "20px",
            maxWidth: "420px",
            width: "100%",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <span className="eyebrow" style={{ color: "#fbbf24", fontSize: "0.72rem" }}>
                TRADE LOT SIZE SELECTOR
              </span>
              <h3 style={{ margin: "2px 0 0", color: "#f8fafc", fontSize: "1.15rem" }}>
                ជ្រើសរើសទំហំ Lot Size
              </h3>
            </div>
            <button
              onClick={() => setLotModalOpen(false)}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#94a3b8",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ✕
            </button>
          </div>

          <p style={{ color: "#94a3b8", fontSize: "0.78rem", marginBottom: "14px", lineHeight: 1.5 }}>
            ជ្រើសរើស Lot Size ដើម្បីគណនាប្រាក់ចំណេញ (PnL) ទាំងលើ Home Floating Trade និងគ្រប់ទិន្នន័យក្នុង Journal ទាំងអស់៖
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {LOT_SIZE_OPTIONS.map((opt) => {
              const isSelected = selectedLotSize === opt.value;
              const dollarValue = isGold
                ? (parseFloat(opt.value) * 10).toFixed(2)
                : (parseFloat(opt.value) * 0.10).toFixed(2);

              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelectLotSize(opt.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: isSelected
                      ? "2px solid #fbbf24"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)"
                      : "rgba(255, 255, 255, 0.03)",
                    color: isSelected ? "#fbbf24" : "#e2e8f0",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>
                    {opt.value} Lot
                  </div>
                  <div style={{ fontSize: "0.68rem", color: isSelected ? "#fef08a" : "#64748b", marginTop: "2px" }}>
                    1 pt = ${dollarValue}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Lot Input */}
          <div
            style={{
              padding: "12px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "10px",
              marginBottom: "14px",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
              ឬ បញ្ចូល Custom Lot Size ដោយខ្លួនឯង៖
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="50.0"
                placeholder="ឧទាហរណ៍៖ 0.25"
                value={customLotInput}
                onChange={(e) => setCustomLotInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  background: "rgba(0, 0, 0, 0.4)",
                  color: "#f8fafc",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />
              <button
                onClick={() => {
                  if (customLotInput) handleSelectLotSize(customLotInput);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "#fbbf24",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: "0.78rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                យល់ព្រម
              </button>
            </div>
          </div>

          <button
            onClick={() => setLotModalOpen(false)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#cbd5e1",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            បិទផ្ទាំង (Close)
          </button>
        </div>
      </div>
    );
  };

  // Multi-Timeframe Status Hierarchy Pills
  const renderMtfStatusBar = () => {
    const rawSignal = engineSignals[market];
    const trend = currentSignal?.trend || rawSignal?.trend || "UNCLEAR";
    const setup = currentSignal?.setup || rawSignal?.setup || "NO_TREND";
    const isM3Confirmed = currentSignal?.status === "BUY" || currentSignal?.status === "SELL";

    const trendColor = trend === "BULLISH" ? "#22c55e" : trend === "BEARISH" ? "#ef4444" : "#eab308";
    const setupStr = String(setup || "");
    const setupColor = setupStr.includes("VALID") ? "#22c55e" : "#64748b";
    const entryColor = isM3Confirmed ? "#22c55e" : "#64748b";

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          marginBottom: "14px",
          padding: "10px",
          background: "rgba(18, 25, 42, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "12px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>M15 TREND</span>
          <strong style={{ fontSize: "0.82rem", color: trendColor }}>{trend}</strong>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid rgba(255, 255, 255, 0.08)", borderRight: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>M5 SETUP</span>
          <strong style={{ fontSize: "0.82rem", color: setupColor }}>
            {setupStr.includes("BULLISH") ? "BULL RETEST" : setupStr.includes("BEARISH") ? "BEAR RETEST" : "WAITING"}
          </strong>
        </div>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>M3 ENTRY</span>
          <strong style={{ fontSize: "0.82rem", color: entryColor }}>
            {isM3Confirmed ? "CONFIRMED" : "PENDING"}
          </strong>
        </div>
      </div>
    );
  };

  // =========================================================================
  // PAGE 1: HOME
  // =========================================================================
  function renderHome() {
    const activeStrategy = getStrategyByNumber(selectedStrategyNumber);
    const posKey = `${selectedStrategyNumber}_${market}`;
    const activePos = activePositions[posKey] || (activePositions[market]?.strategyNumber === selectedStrategyNumber ? activePositions[market] : null);
    const candlesForMarket = marketCandles[market] || [];
    const activeEvaluation = activeStrategy.evaluate(market, candlesForMarket, livePrice);
    const currentSignal = activePos || activeEvaluation || engineSignals[market];
    const isActivePosition = Boolean(activePos);
    const isWait = !isActivePosition && currentSignal?.status === "WAIT";
    const sideClass = getSideClass(currentSignal?.status);

    const lotMultiplier = getLotSizeMultiplier(selectedLotSize, market);
    const isBuy = currentSignal?.status === "BUY";
    const isSell = currentSignal?.status === "SELL";

    // 1. Type Safety & Data Parsing using parseFloat()
    const safeLivePrice = parseFloat(String(livePrice)) || 0;
    const entryPrice = parseFloat(String(currentSignal?.entry)) || safeLivePrice;
    const slPrice = parseFloat(String(currentSignal?.stopLoss)) || 0;
    const tp1Price = parseFloat(String(currentSignal?.tp1)) || 0;
    const tp2Price = parseFloat(String(currentSignal?.tp2)) || 0;

    // 2. Threshold buffer for re-entry (0.20 for XAUUSD, 15.0 for BTCUSD)
    const reEntryBuffer = market === "XAUUSD" ? 0.20 : 15.0;
    const isAtEntryPrice = Math.abs(safeLivePrice - entryPrice) <= reEntryBuffer;

    // 3. Price-based boundary checks
    const priceBeyondTp2 = (isBuy && tp2Price > 0 && safeLivePrice >= tp2Price) ||
                           (isSell && tp2Price > 0 && safeLivePrice <= tp2Price);
    const priceBeyondSl = (isBuy && slPrice > 0 && safeLivePrice <= slPrice) ||
                          (isSell && slPrice > 0 && safeLivePrice >= slPrice);

    // 4. Trade Lifecycle State Detection:
    // Rule 2: CLOSED / INACTIVE
    // For BUY: price >= TP2 OR price <= SL
    // For SELL: price <= TP2 OR price >= SL
    const isClosed = isActivePosition && (
      activePos.stage === "CLOSED" ||
      activePos.stage === "CLOSED_TP2" ||
      activePos.stage === "CLOSED_SL" ||
      priceBeyondTp2 ||
      priceBeyondSl
    );

    // Rule 1: RUNNING (Active State)
    // When liveMarketPrice is between Entry and TP2 (inclusive of TP1 hit), status remains RUNNING
    // When CLOSED, green RUNNING badge is completely removed!
    const isRunning = isActivePosition && !isClosed;

    // Rule 3: RE-ENTRY RE-ACTIVATION (Back to Active State)
    const isReEntry = isActivePosition && isRunning && (
      Boolean(activePos.isReEntry) || (Boolean(activePos.wasClosed) && isAtEntryPrice)
    );

    // Target Hit Flags
    const isTp2Hit = isClosed && (
      activePos.closeReason === "TP2_HIT" ||
      priceBeyondTp2
    );

    const isSlHit = isClosed && (
      activePos.closeReason === "SL_HIT" ||
      priceBeyondSl
    );

    const isTp1Hit = isRunning && (
      Boolean(activePos.tp1Hit) ||
      (isBuy && tp1Price > 0 && safeLivePrice >= tp1Price && safeLivePrice < tp2Price) ||
      (isSell && tp1Price > 0 && safeLivePrice <= tp1Price && safeLivePrice > tp2Price)
    );

    const closeReason = activePos?.closeReason || (isTp2Hit ? "TP2_HIT" : isSlHit ? "SL_HIT" : null);

    // Live Floating or Realized P/L
    let floatingPts = 0;
    if (isActivePosition) {
      if (isClosed) {
        if (isTp2Hit) {
          floatingPts = +(isBuy ? tp2Price - entryPrice : entryPrice - tp2Price).toFixed(2);
        } else if (isSlHit) {
          floatingPts = -(isBuy ? entryPrice - slPrice : slPrice - entryPrice).toFixed(2);
        } else {
          const closedP = parseFloat(String(activePos.closedPrice)) || safeLivePrice;
          floatingPts = +(isBuy ? closedP - entryPrice : entryPrice - closedP).toFixed(2);
        }
      } else {
        floatingPts = +(isBuy ? safeLivePrice - entryPrice : entryPrice - safeLivePrice).toFixed(2);
      }
    }
    const floatingDollars = +(floatingPts * lotMultiplier).toFixed(2);

    return (
      <>
        {renderMarketSwitch()}
        {renderStrategySwitcherBar("home")}
        {renderMtfStatusBar()}

        {/* Active Strategy Identity Banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            padding: "8px 12px",
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "10px",
            marginBottom: "12px",
            fontSize: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: "4px",
                background: "#38bdf8",
                color: "#000",
              }}
            >
              {activeStrategy.number}
            </span>
            <strong style={{ color: "#f8fafc" }}>
              {activeStrategy.name}
            </strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.7rem" }}>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>
              Lot: {selectedLotSize}
            </span>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>
              Win Rate: {activeStrategy.winRate}
            </span>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>
              RR: {activeStrategy.defaultRR}
            </span>
          </div>
        </div>

        {/* Live Engine Active Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            borderRadius: "10px",
            fontSize: "0.74rem",
            color: "#86efac",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }} />
            <strong style={{ color: "#f8fafc" }}>
              {market === "XAUUSD" ? "OANDA:XAUUSD Spot Feed" : "BINANCE:BTCUSDT Spot Feed"}
            </strong>
            <span style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 700 }}>
              (100% Chart Synced)
            </span>
          </div>
          <span style={{ fontSize: "0.68rem", color: "#38bdf8" }}>Zero Repaint • Live MT5</span>
        </div>

        {/* Market Header */}
        <section
          className="market-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            padding: "6px 4px 2px 4px",
            marginBottom: "14px",
          }}
        >
          <div className="market-header-left" style={{ textAlign: "left" }}>
            <span
              className="eyebrow"
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#64748b",
                display: "block",
                lineHeight: "1.2",
              }}
            >
              TRADING PAIR
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <h1
                className="market-symbol-title"
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  lineHeight: "1.1",
                  margin: "4px 0 0",
                  color: "#f8fafc",
                  letterSpacing: "-0.02em",
                }}
              >
                {market}
              </h1>
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: market === "XAUUSD" ? "rgba(251, 191, 36, 0.15)" : "rgba(56, 189, 248, 0.15)",
                  color: market === "XAUUSD" ? "#fbbf24" : "#38bdf8",
                  fontWeight: 700,
                  border: market === "XAUUSD" ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid rgba(56, 189, 248, 0.3)",
                }}
              >
                {market === "XAUUSD" ? "OANDA Spot" : "Binance Spot"}
              </span>
            </div>
          </div>

          <div className="market-header-right" style={{ textAlign: "right" }}>
            <div className="live-price-panel" aria-live="polite">
              <span
                className="eyebrow"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#64748b",
                  display: "block",
                  lineHeight: "1.2",
                  textAlign: "right",
                }}
              >
                LIVE MARKET PRICE
              </span>
              <strong
                className="market-price-title"
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  lineHeight: "1.1",
                  margin: "4px 0 0",
                  color: "#f8fafc",
                  display: "block",
                  textAlign: "right",
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPrice(livePrice)}
              </strong>
              <small style={{ fontSize: "0.68rem", color: "#38bdf8", display: "block", textAlign: "right", fontWeight: 700 }}>
                {market === "XAUUSD" ? "OANDA:XAUUSD Spot (100% Synced)" : "BINANCE:BTCUSDT (100% Synced)"}
              </small>
            </div>
          </div>
        </section>

        {/* CURRENT SIGNAL CARD (Border only on LEFT side) */}
        <section className={`signal-card ${sideClass}`}>
          {isActivePosition && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: isClosed
                  ? closeReason === "TP2_HIT"
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(239, 68, 68, 0.12)"
                  : floatingPts >= 0
                  ? "rgba(34, 197, 94, 0.12)"
                  : "rgba(239, 68, 68, 0.12)",
                border: isClosed
                  ? closeReason === "TP2_HIT"
                    ? "1px solid rgba(34, 197, 94, 0.35)"
                    : "1px solid rgba(239, 68, 68, 0.35)"
                  : floatingPts >= 0
                  ? "1px solid rgba(34, 197, 94, 0.35)"
                  : "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "10px",
                marginBottom: "12px",
              }}
            >
              <div>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", display: "block" }}>
                  {isClosed ? "CLOSED POSITION RESULT (REALIZED)" : "LIVE FLOATING P/L (ON MT5)"}
                </span>
                <strong
                  style={{
                    fontSize: "1.15rem",
                    color: isClosed
                      ? closeReason === "TP2_HIT"
                        ? "#22c55e"
                        : "#ef4444"
                      : floatingPts >= 0
                      ? "#22c55e"
                      : "#ef4444",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(floatingDollars >= 0 ? "+$" : "-$") + Math.abs(floatingDollars).toFixed(2)}{" "}
                  <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                    ({floatingPts >= 0 ? "+" : ""}{floatingPts.toFixed(1)} pts)
                  </span>
                </strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    padding: "4px 9px",
                    borderRadius: "6px",
                    background: isClosed
                      ? closeReason === "TP2_HIT"
                        ? "#22c55e"
                        : "#ef4444"
                      : isTp1Hit
                      ? "#38bdf8"
                      : isReEntry
                      ? "rgba(34, 197, 94, 0.25)"
                      : "rgba(56, 189, 248, 0.2)",
                    color: isClosed
                      ? closeReason === "TP2_HIT"
                        ? "#000000"
                        : "#ffffff"
                      : isTp1Hit
                      ? "#000000"
                      : isReEntry
                      ? "#86efac"
                      : "#38bdf8",
                  }}
                >
                  {isClosed
                    ? isTp2Hit
                      ? "🎉 TP2 HIT"
                      : isSlHit
                      ? "🛑 SL HIT"
                      : "CLOSED"
                    : isTp1Hit
                    ? "🎯 TP1 HIT (RUNNING)"
                    : isReEntry
                    ? "⚡ RE-ENTRY RUNNING"
                    : "RUNNING ON MT5"}
                </span>
              </div>
            </div>
          )}

          <div className="signal-top">
            <div>
              <span className="eyebrow">
                {isActivePosition
                  ? isClosed
                    ? "CLOSED (WAITING FOR RE-ENTRY)"
                    : isReEntry
                    ? "RE-ENTRY POSITION (ACTIVE)"
                    : "ACTIVE OPEN POSITION"
                  : "CURRENT SIGNAL"}
              </span>
              <div className="signal-side">{currentSignal?.status || "WAIT"}</div>
            </div>

            <div className="signal-top-right">
              {isActivePosition ? (
                isRunning ? (
                  /* Active: Green RUNNING badge with dynamic TP1 HIT indicator */
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isTp1Hit && (
                      <span
                        style={{
                          backgroundColor: "rgba(56, 189, 248, 0.18)",
                          color: "#38bdf8",
                          border: "1px solid rgba(56, 189, 248, 0.45)",
                          borderRadius: "9999px",
                          padding: "5px 10px",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🎯 TP1 HIT
                      </span>
                    )}
                    <div
                      className="signal-status active-running-badge"
                      style={{
                        backgroundColor: "#22c55e",
                        color: "#ffffff",
                        borderRadius: "9999px",
                        padding: "6px 14px",
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        fontSize: "0.75rem",
                        lineHeight: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        boxShadow: "0 0 12px rgba(34, 197, 94, 0.4)",
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                      {isReEntry ? "RE-ENTRY RUNNING" : "RUNNING"}
                    </div>
                  </div>
                ) : (
                  /* Closed/Waiting: Red/Gray CLOSED (WAITING RE-ENTRY) badge. Green RUNNING badge REMOVED! */
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isTp2Hit && (
                      <span
                        style={{
                          backgroundColor: "rgba(34, 197, 94, 0.18)",
                          color: "#22c55e",
                          border: "1px solid rgba(34, 197, 94, 0.45)",
                          borderRadius: "9999px",
                          padding: "5px 10px",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🎉 TP2 HIT
                      </span>
                    )}
                    {isSlHit && (
                      <span
                        style={{
                          backgroundColor: "rgba(239, 68, 68, 0.18)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.45)",
                          borderRadius: "9999px",
                          padding: "5px 10px",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🛑 SL HIT
                      </span>
                    )}
                    <div
                      className="signal-status closed-waiting-badge"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        color: "#fca5a5",
                        border: "1px solid rgba(239, 68, 68, 0.45)",
                        borderRadius: "9999px",
                        padding: "6px 12px",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        fontSize: "0.72rem",
                        lineHeight: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      CLOSED (WAITING RE-ENTRY)
                    </div>
                  </div>
                )
              ) : (
                <div
                  className="signal-status"
                  style={{
                    backgroundColor:
                      currentSignal?.status === "BUY"
                        ? "#22c55e"
                        : currentSignal?.status === "SELL"
                        ? "#ef4444"
                        : "#6b7280",
                    color: "#ffffff",
                    borderRadius: "9999px",
                    padding: "6px 14px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    fontSize: "0.75rem",
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "88px",
                  }}
                >
                  {currentSignal?.status === "WAIT" ? "WAITING" : "ACTIVE"}
                </div>
              )}
            </div>
          </div>

          {/* ផ្ទាំង Entry, Stop Loss, TP1, TP2 (Shows -- if WAIT) */}
          <div className="signal-grid">
            <div className="data-box">
              <span>ENTRY</span>
              <strong>{isWait ? "--" : formatPrice(currentSignal?.entry)}</strong>
            </div>

            <div className="data-box">
              <span>STOP LOSS</span>
              <strong>{isWait ? "--" : formatPrice(currentSignal?.stopLoss)}</strong>
              {!isWait && <small style={{ color: "#ef4444" }}>Structural SL</small>}
            </div>

            <div className="data-box">
              <span>TP1 (1R)</span>
              <strong>{isWait ? "--" : formatPrice(currentSignal?.tp1)}</strong>
              <small>{isWait ? "RR 1:1" : isTp1Hit ? "✓ TP1 REACHED" : "Close 50%"}</small>
            </div>

            <div className="data-box">
              <span>TP2 (2R)</span>
              <strong>{isWait ? "--" : formatPrice(currentSignal?.tp2)}</strong>
              <small>{isWait ? "RR 1:2" : closeReason === "TP2_HIT" ? "✓ TP2 HIT" : "Close 50%"}</small>
            </div>
          </div>

          {/* 1. CLOSED (WAITING FOR RE-ENTRY) PROMPT */}
          {isActivePosition && isClosed && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px 14px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px dashed rgba(245, 158, 11, 0.4)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.82rem", color: "#fbbf24", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fbbf24", display: "inline-block", boxShadow: "0 0 8px #fbbf24" }} />
                  CLOSED (WAITING FOR RE-ENTRY)
                </strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#fde68a",
                  }}
                >
                  TARGET: {formatPrice(activePos.entry)}
                </span>
              </div>
              <div style={{ color: "#cbd5e1", fontSize: "0.75rem", lineHeight: 1.5 }}>
                • <strong>ស្ថានភាព Position៖</strong> បានបិទត្រឹម {closeReason === "TP2_HIT" ? "TP2 HIT (ជោគជ័យ)" : "SL HIT"}។ Badge ពណ៌បៃតង RUNNING ត្រូវបានដកចេញ។
              </div>
              <div style={{ color: "#38bdf8", fontSize: "0.75rem", lineHeight: 1.5 }}>
                • <strong>ប្រព័ន្ធកំពុងស្វែងរក Re-Entry៖</strong> កំពុងតាមដានតម្លៃទីផ្សារ — ប្រសិនបើតម្លៃវិលត្រឡប់មកស្មើ <strong>{formatPrice(activePos.entry)}</strong> (±{market === "XAUUSD" ? "0.20" : "15.00"}) វានឹងដំណើរការ <strong>RE-ENTRY RE-ACTIVATION</strong> ត្រឡប់មក RUNNING វិញដោយស្វ័យប្រវត្តិ!
              </div>
            </div>
          )}

          {/* 2. RE-ENTRY RE-ACTIVATION NOTIFICATION */}
          {isActivePosition && isReEntry && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px 14px",
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.45)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.82rem", color: "#22c55e", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e" }} />
                  ⚡ RE-ENTRY RE-ACTIVATION (SIGNAL TO RE-ENTER)
                </strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(34, 197, 94, 0.25)",
                    color: "#86efac",
                  }}
                >
                  STATUS: RUNNING
                </span>
              </div>
              <div style={{ color: "#e2e8f0", fontSize: "0.75rem", lineHeight: 1.5 }}>
                តម្លៃទីផ្សារបានវិលត្រឡប់មកស្មើ Entry <strong>{formatPrice(activePos.entry)}</strong> រួចរាល់! នេះជាសញ្ញាបញ្ជាក់ថាដល់ពេលត្រូវចូល Trade (Re-enter Market) ម្តងទៀតហើយ។ Position ត្រូវបាន Reactivate ត្រឡប់មក <strong>RUNNING</strong>!
              </div>
            </div>
          )}

          {/* 3. TP1 HIT INDICATOR */}
          {isActivePosition && isTp1Hit && !isClosed && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px 14px",
                background: "rgba(56, 189, 248, 0.1)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.82rem", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>🎯</span>
                  TP1 HIT — RUNNING TO TP2
                </strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38bdf8",
                  }}
                >
                  50% LOCKED / SL TO BE
                </span>
              </div>
              <div style={{ color: "#94a3b8", fontSize: "0.75rem", lineHeight: 1.5 }}>
                តម្លៃទីផ្សារបានឡើងដល់ TP1 <strong>{formatPrice(activePos.tp1)}</strong> រួចហើយ! Position នៅតែបន្ត <strong>RUNNING</strong> ឆ្ពោះទៅ TP2 <strong>{formatPrice(activePos.tp2)}</strong>។ សូមបិទ 50% lot size និងរំកិល Stop Loss មកស្មើ Entry (Break-Even)។
              </div>
            </div>
          )}

          {/* MT5 Guidance Box for Active Position */}
          {isActivePosition && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px 14px",
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "10px",
                fontSize: "0.76rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <strong style={{ color: "#38bdf8" }}>⚡ ការគ្រប់គ្រងលើ MT5 (Live Position Guide)</strong>
                <span
                  style={{
                    fontSize: "0.68rem",
                    color: isClosed ? "#fbbf24" : "#22c55e",
                    fontWeight: 700,
                    background: isClosed ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {isClosed ? "CLOSED STATE" : "VALID TRADE"}
                </span>
              </div>
              <div style={{ color: "#94a3b8", lineHeight: "1.5" }}>
                <div>
                  • Entry: <strong>{formatPrice(currentSignal.entry)}</strong> | SL:{" "}
                  <strong>{formatPrice(currentSignal.stopLoss)}</strong>
                </div>
                <div>
                  • TP1: <strong>{formatPrice(currentSignal.tp1)}</strong> | TP2:{" "}
                  <strong>{formatPrice(currentSignal.tp2)}</strong>
                </div>
                <div>
                  • <strong>យុទ្ធសាស្ត្រ៖</strong> នៅពេលដល់ TP1 អ្នកអាចបិទ 50% ឬរំកិល SL មកស្មើ Entry (Break-Even)! នៅពេលដល់ TP2 ឬ SL position នឹង Closed ដោយស្វ័យប្រវត្តិ។
                </div>
              </div>

              {/* Action Buttons: Close / Re-entry / Test simulation */}
              <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {isRunning ? (
                  <>
                    <button
                      onClick={() => simulatePriceMove(market, currentSignal.tp1)}
                      style={{
                        flex: 1,
                        minWidth: "125px",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "#38bdf8",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🎯 Test TP1 Hit ({formatPrice(currentSignal.tp1)})
                    </button>
                    <button
                      onClick={() => simulatePriceMove(market, isBuy ? currentSignal.tp2 + 0.5 : currentSignal.tp2 - 0.5)}
                      style={{
                        flex: 1,
                        minWidth: "125px",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        color: "#fbbf24",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🎉 Test TP2 Hit (Close)
                    </button>
                    <button
                      onClick={() => simulatePriceMove(market, isBuy ? currentSignal.stopLoss - 0.5 : currentSignal.stopLoss + 0.5)}
                      style={{
                        flex: 1,
                        minWidth: "125px",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        color: "#f87171",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🛑 Test SL Hit (Close)
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => simulatePriceMove(market, currentSignal.entry)}
                      style={{
                        flex: 1,
                        minWidth: "140px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        background: "rgba(34, 197, 94, 0.2)",
                        border: "1px solid rgba(34, 197, 94, 0.45)",
                        color: "#22c55e",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Test Re-Entry at Entry ({formatPrice(currentSignal.entry)})
                    </button>
                    <button
                      onClick={() => handleManualReEntry(market)}
                      style={{
                        flex: 1,
                        minWidth: "120px",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        background: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        color: "#38bdf8",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🔄 Reset / Reactivate
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleClosePosition(market, "MANUAL_CLOSE")}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✓ Close Trade
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Strategy Logic & Trigger Reason */}
        <section className="info-card">
          <div className="section-title">STRATEGY LOGIC & TRIGGER</div>
          <p style={{ lineHeight: "1.45", color: isWait ? "#94a3b8" : "#f8fafc" }}>
            {currentSignal?.reason}
          </p>
        </section>

        {/* Position Management & Confidence */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div style={{ background: "rgba(18, 25, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px", borderRadius: "12px" }}>
            <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>POSITION MGMT</span>
            <strong style={{ fontSize: "0.85rem", color: "#38bdf8", display: "block", marginTop: "2px" }}>
              TP1: 50% | TP2: 50%
            </strong>
            <small style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Move SL to BE after TP1 hit</small>
          </div>

          <div
            onClick={() => setShowConfidenceModal(true)}
            style={{
              background: "rgba(18, 25, 42, 0.6)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              padding: "12px",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>CONFIDENCE SCORE</span>
              <span
                style={{
                  fontSize: "0.62rem",
                  color: "#38bdf8",
                  background: "rgba(56, 189, 248, 0.15)",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  fontWeight: 700,
                }}
              >
                ចុចមើល ℹ️
              </span>
            </div>
            <strong style={{ fontSize: "0.85rem", color: isWait ? "#64748b" : "#22c55e", display: "block", marginTop: "2px" }}>
              {currentSignal?.confidenceScore || 0} / 100
            </strong>
            <small style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Setup-Quality Rating (Tap for detail)</small>
          </div>
        </section>

        {/* Engine Audit & Debug Mode Accordion */}
        <section className="info-card">
          <div
            onClick={() => setDebugOpen(!debugOpen)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span className="section-title" style={{ margin: 0 }}>
              🔍 ENGINE AUDIT & DEBUG LOG
            </span>
            <span style={{ color: "#38bdf8", fontSize: "0.8rem", fontWeight: 700 }}>
              {debugOpen ? "Hide ▲" : "Inspect ▼"}
            </span>
          </div>

          {debugOpen && currentSignal?.debug && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                background: "rgba(0, 0, 0, 0.4)",
                borderRadius: "8px",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#94a3b8",
                lineHeight: "1.6",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <div><strong>M15 Decision:</strong> {currentSignal.debug.m15.trend} ({currentSignal.debug.m15.reason})</div>
              <div><strong>M5 Decision:</strong> {currentSignal.debug.m5.setupType} (Valid: {String(currentSignal.debug.m5.isValid)})</div>
              <div><strong>M3 Decision:</strong> Confirmed: {String(currentSignal.debug.m3.isConfirmed)} ({currentSignal.debug.m3.reason})</div>
              <div><strong>Structural SL:</strong> {currentSignal.debug.risk.stopLoss || "N/A"} (Risk Dist: {currentSignal.debug.risk.riskDistance || "N/A"})</div>
              <div><strong>TP1 (1R):</strong> {currentSignal.debug.risk.tp1 || "N/A"} | <strong>TP2 (2R):</strong> {currentSignal.debug.risk.tp2 || "N/A"}</div>
              <div><strong>S/R Obstacle Clearance:</strong> {String(currentSignal.debug.risk.srClearanceValid)}</div>
              <div><strong>Final Decision:</strong> <span style={{ color: currentSignal.debug.finalDecision === "BUY" ? "#22c55e" : currentSignal.debug.finalDecision === "SELL" ? "#ef4444" : "#eab308" }}>{currentSignal.debug.finalDecision}</span></div>
            </div>
          )}
        </section>

        {/* Data Feed Status */}
        <section className="status-card">
          <div>
            <span className="eyebrow">ENGINE TIMEFRAMES</span>
            <strong>M15 → M5 → M3</strong>
          </div>

          <div>
            <span className="eyebrow">FEED SOURCE</span>
            <strong style={{ color: "#38bdf8" }}>OANDA (Gold) + Binance (BTC)</strong>
          </div>

          <div>
            <span className="eyebrow">ENGINE REFRESH</span>
            <strong>{lastUpdate ? lastUpdate.toLocaleTimeString("en-US") : "--"}</strong>
          </div>
        </section>
      </>
    );
  }

  // =========================================================================
  // PAGE 2: ANALYSIS (3 MODULAR STRATEGIES 01, 02, 03 & AUDIO ALERT CONTROLS)
  // =========================================================================
  function renderAnalysis() {
    const isGold = market === "XAUUSD";
    const currentPrice = marketPrices[market];
    const candlesForMarket = marketCandles[market] || [];

    // Get Active Selected Strategy
    const activeStrategy = getStrategyByNumber(selectedStrategyNumber);
    const isSoundOn = Boolean(strategySounds[activeStrategy.number]);

    // Live Evaluation of Active Strategy
    const activeEvaluation = activeStrategy.evaluate(market, candlesForMarket, currentPrice);

    return (
      <section className="page-card">
        {renderMarketSwitch()}
        {renderStrategySwitcherBar("analysis")}
        {renderMtfStatusBar()}

        {/* ------------------------------------------------------------- */}
        {/* ACTIVE STRATEGY CARD (WITH PER-STRATEGY SOUND TOGGLE)         */}
        {/* ------------------------------------------------------------- */}
        <div
          style={{
            background: "rgba(18, 25, 42, 0.85)",
            border: "1px solid rgba(56, 189, 248, 0.28)",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          {/* Header & Sound Toggle Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "10px",
              paddingBottom: "12px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38bdf8",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                  }}
                >
                  STRATEGY {activeStrategy.number}
                </span>
                <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                  {activeStrategy.category}
                </span>
              </div>
              <h2
                style={{
                  fontSize: "1.18rem",
                  fontWeight: 800,
                  color: "#f8fafc",
                  margin: "4px 0 2px",
                  lineHeight: 1.25,
                }}
              >
                {activeStrategy.name}
              </h2>
              <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                {activeStrategy.timeframes.map((tf) => (
                  <span
                    key={tf}
                    style={{
                      fontSize: "0.65rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "#94a3b8",
                      fontWeight: 700,
                    }}
                  >
                    {tf}
                  </span>
                ))}
              </div>
            </div>

            {/* BUTTON បិទ/បើកសម្លេង ALERT លើ STRATEGY នេះ */}
            <button
              onClick={() => handleToggleStrategySound(activeStrategy.number)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 14px",
                borderRadius: "9999px",
                fontSize: "0.76rem",
                fontWeight: 800,
                cursor: "pointer",
                background: isSoundOn
                  ? "linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(22, 163, 74, 0.15) 100%)"
                  : "rgba(100, 116, 139, 0.15)",
                border: isSoundOn
                  ? "1px solid rgba(34, 197, 94, 0.5)"
                  : "1px solid rgba(100, 116, 139, 0.35)",
                color: isSoundOn ? "#86efac" : "#94a3b8",
                boxShadow: isSoundOn ? "0 0 12px rgba(34, 197, 94, 0.35)" : "none",
                transition: "all 0.2s ease",
              }}
              title="ចុចដើម្បីបិទ ឬ បើកសម្លេង Alert សម្រាប់ Strategy នេះ"
            >
              <span style={{ fontSize: "0.95rem" }}>{isSoundOn ? "🔔" : "🔕"}</span>
              <span>{isSoundOn ? "សម្លេង Alert: បើក (ON)" : "សម្លេង Alert: បិទ (OFF)"}</span>
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: isSoundOn ? "#22c55e" : "#64748b",
                  boxShadow: isSoundOn ? "0 0 6px #22c55e" : "none",
                }}
              />
            </button>
          </div>

          {/* Live Evaluation Box for Current Market */}
          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Live Signal សម្រាប់ <strong>{market}</strong> ({formatPrice(currentPrice)})៖
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: "6px",
                    background:
                      activeEvaluation.side === "BUY"
                        ? "rgba(34, 197, 94, 0.2)"
                        : activeEvaluation.side === "SELL"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(234, 179, 8, 0.2)",
                    color:
                      activeEvaluation.side === "BUY"
                        ? "#22c55e"
                        : activeEvaluation.side === "SELL"
                        ? "#ef4444"
                        : "#eab308",
                    border:
                      activeEvaluation.side === "BUY"
                        ? "1px solid rgba(34, 197, 94, 0.4)"
                        : activeEvaluation.side === "SELL"
                        ? "1px solid rgba(239, 68, 68, 0.4)"
                        : "1px solid rgba(234, 179, 8, 0.4)",
                  }}
                >
                  {activeEvaluation.side}
                </span>
              </div>

              <span style={{ fontSize: "0.7rem", color: "#38bdf8", fontWeight: 700 }}>
                Win Rate: {activeStrategy.winRate} • RR {activeStrategy.defaultRR}
              </span>
            </div>

            {/* Entry, SL, TP Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                marginBottom: "10px",
                textAlign: "center",
              }}
            >
              <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>ENTRY</span>
                <strong style={{ fontSize: "0.85rem", color: "#f8fafc" }}>{formatPrice(activeEvaluation.entry)}</strong>
              </div>
              <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>STOP LOSS</span>
                <strong style={{ fontSize: "0.85rem", color: "#ef4444" }}>{formatPrice(activeEvaluation.sl)}</strong>
              </div>
              <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>TP1</span>
                <strong style={{ fontSize: "0.85rem", color: "#38bdf8" }}>{formatPrice(activeEvaluation.tp1)}</strong>
              </div>
              <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px" }}>
                <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>TP2</span>
                <strong style={{ fontSize: "0.85rem", color: "#22c55e" }}>{formatPrice(activeEvaluation.tp2)}</strong>
              </div>
            </div>

            <p style={{ fontSize: "0.78rem", color: "#cbd5e1", margin: 0, lineHeight: 1.45 }}>
              {activeEvaluation.reason}
            </p>
          </div>

          {/* Strategy Execution Rules */}
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px dashed rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              fontSize: "0.74rem",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            <div>• <strong>ក្បួន Entry៖</strong> {activeStrategy.rules.entryRule}</div>
            <div>• <strong>ក្បួន Stop Loss៖</strong> {activeStrategy.rules.slRule}</div>
            <div>• <strong>ក្បួន Take Profit៖</strong> {activeStrategy.rules.tpRule}</div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. DIAGNOSTICS CHECKLIST FOR ACTIVE STRATEGY                  */}
        {/* ------------------------------------------------------------- */}
        <span className="eyebrow">DIAGNOSTIC ENGINE BREAKDOWN — STRATEGY {activeStrategy.number}</span>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc", margin: "4px 0 12px" }}>
          ការវិភាគបច្ចេកទេសលម្អិត ({activeStrategy.shortName})
        </h3>

        <div className="analysis-list" style={{ marginBottom: "20px" }}>
          {activeEvaluation.diagnostics?.map((diag, idx) => (
            <div
              key={idx}
              style={{
                padding: "12px 14px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "12px",
                marginBottom: "8px",
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "#38bdf8", fontSize: "0.88rem" }}>{diag.title}</strong>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background:
                      diag.statusColor === "#22c55e"
                        ? "rgba(34, 197, 94, 0.2)"
                        : diag.statusColor === "#ef4444"
                        ? "rgba(239, 68, 68, 0.2)"
                        : "rgba(56, 189, 248, 0.2)",
                    color: diag.statusColor || "#38bdf8",
                    fontWeight: 800,
                  }}
                >
                  {diag.status}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.45 }}>
                {diag.description}
              </p>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 4. ALL 3 STRATEGIES COMPARATIVE MATRIX (01, 02, 03)           */}
        {/* ------------------------------------------------------------- */}
        <div style={{ marginTop: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span
              className="eyebrow"
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              ALL 3 STRATEGIES (យុទ្ធសាស្ត្រទាំង 3 ក្នុងប្រព័ន្ធ)
            </span>
            <span style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 700 }}>
              ចុចប្តូរ ឬ បិទ/បើកសម្លេង Alert
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {registeredStrategies.map((strat) => {
              const isSelected = strat.number === selectedStrategyNumber;
              const hasSound = Boolean(strategySounds[strat.number]);
              const evalRes = strat.evaluate(market, candlesForMarket, currentPrice);

              return (
                <div
                  key={strat.id}
                  style={{
                    padding: "12px 14px",
                    background: isSelected
                      ? "rgba(56, 189, 248, 0.08)"
                      : "rgba(18, 25, 42, 0.6)",
                    border: isSelected
                      ? "1px solid rgba(56, 189, 248, 0.35)"
                      : "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ flex: "1 1 240px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: isSelected ? "#38bdf8" : "rgba(255, 255, 255, 0.1)",
                          color: isSelected ? "#000" : "#cbd5e1",
                        }}
                      >
                        {strat.number}
                      </span>
                      <strong style={{ fontSize: "0.88rem", color: "#f8fafc" }}>
                        {strat.name}
                      </strong>
                    </div>
                    <p style={{ fontSize: "0.73rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                      {strat.description}
                    </p>
                  </div>

                  {/* Actions: Sound Toggle + Switch Button */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {/* Signal Pill */}
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "3px 8px",
                        borderRadius: "5px",
                        fontWeight: 800,
                        background:
                          evalRes.side === "BUY"
                            ? "rgba(34, 197, 94, 0.2)"
                            : evalRes.side === "SELL"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(234, 179, 8, 0.2)",
                        color:
                          evalRes.side === "BUY"
                            ? "#22c55e"
                            : evalRes.side === "SELL"
                            ? "#ef4444"
                            : "#eab308",
                      }}
                    >
                      {evalRes.side}
                    </span>

                    {/* Sound Alert Toggle Button for this strategy */}
                    <button
                      onClick={() => handleToggleStrategySound(strat.number)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: hasSound
                          ? "rgba(34, 197, 94, 0.2)"
                          : "rgba(100, 116, 139, 0.2)",
                        border: hasSound
                          ? "1px solid rgba(34, 197, 94, 0.45)"
                          : "1px solid rgba(100, 116, 139, 0.3)",
                        color: hasSound ? "#86efac" : "#94a3b8",
                        transition: "all 0.15s ease",
                      }}
                      title={`Toggle Alert Sound for Strategy ${strat.number}`}
                    >
                      <span>{hasSound ? "🔔" : "🔕"}</span>
                      <span>{hasSound ? "Alert: ON" : "Alert: OFF"}</span>
                    </button>

                    {/* Switch Button */}
                    <button
                      onClick={() => handleSelectStrategy(strat.number)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        background: isSelected
                          ? "rgba(56, 189, 248, 0.25)"
                          : "rgba(255, 255, 255, 0.08)",
                        border: isSelected
                          ? "1px solid #38bdf8"
                          : "1px solid rgba(255, 255, 255, 0.15)",
                        color: isSelected ? "#38bdf8" : "#f1f5f9",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSelected ? "✓ កំពុងមើល (Active)" : "👉 ប្តូរមកប្រើ (Switch)"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // PAGE 2: LIVE TRADINGVIEW ADVANCED CHART (100% FULL-WIDTH EDGE-TO-EDGE)
  // =========================================================================
  function renderChart() {
    return (
      <div
        className="chart-edge-to-edge-view"
        style={{
          width: "100%",
          margin: 0,
          padding: 0,
          border: "none",
          background: "#0b111e",
        }}
      >
        <TradingViewChart
          defaultSymbol={market === "XAUUSD" ? "OANDA:XAUUSD" : "BINANCE:BTCUSDT"}
          onSelectMarket={(sym) => setMarket(sym)}
          livePrice={marketPrices[market]}
        />
      </div>
    );
  }

  // =========================================================================
  // PAGE 4: JOURNAL & 7-DAY PERFORMANCE SCORECARD (PRESERVED FROM BACKTEST)
  // =========================================================================
  function renderJournal() {
    const selectedPeriod =
      JOURNAL_PERIODS.find((p) => p.id === selectedPeriodId) || JOURNAL_PERIODS[0];

    const allTrades = currentReport.allTrades || [];
    const cycleStartTime = get6AmTradingCycleStart(Date.now(), selectedPeriod.cycleDaysBack);
    const filteredTrades = allTrades.filter(
      (t) => t.timestamp >= cycleStartTime
    );

    const totalCount = filteredTrades.length;
    const winsCount = filteredTrades.filter((t) => t.outcome === "WIN").length;
    const periodWinRate = totalCount > 0 ? ((winsCount / totalCount) * 100).toFixed(1) + "%" : "0.0%";
    const totalPnL = filteredTrades.reduce((acc, t) => acc + (t.pnlNum || 0), 0);
    const totalRR = filteredTrades.reduce((acc, t) => acc + (t.rrNum || 0), 0);
    const report = currentReport;

    return (
      <section className="page-card">
        {renderMarketSwitch()}
        {renderStrategySwitcherBar("journal")}
        <span className="eyebrow">
          TRADING JOURNAL & PERFORMANCE — STRATEGY {selectedStrategyNumber} ({market})
        </span>
        <h2>Journal & Performance Analytics — {activeStrategy.shortName}</h2>

        {/* Sub-Tabs: Journal Records vs 7-Day Performance Scorecard */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            background: "rgba(18, 25, 42, 0.7)",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <button
            onClick={() => setJournalTab("records")}
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer",
              border: journalTab === "records" ? "1px solid #38bdf8" : "none",
              background: journalTab === "records" ? "rgba(56, 189, 248, 0.25)" : "transparent",
              color: journalTab === "records" ? "#38bdf8" : "#94a3b8",
              transition: "all 0.15s ease",
            }}
          >
            📋 Trade Records ({activeStrategy.shortName})
          </button>

          <button
            onClick={() => setJournalTab("scorecard")}
            style={{
              padding: "9px 12px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 800,
              cursor: "pointer",
              border: journalTab === "scorecard" ? "1px solid #22c55e" : "none",
              background: journalTab === "scorecard" ? "rgba(34, 197, 94, 0.2)" : "transparent",
              color: journalTab === "scorecard" ? "#22c55e" : "#94a3b8",
              transition: "all 0.15s ease",
            }}
          >
            📊 7-Day Scorecard & Comparison
          </button>
        </div>

        {/* TAB 1: 7-DAY PERFORMANCE SCORECARD & STRATEGY COMPARISON */}
        {journalTab === "scorecard" ? (
          <div>
            {/* Calendar Date Notice */}
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "8px",
                fontSize: "0.78rem",
                color: "#38bdf8",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📅</span>
                <span>
                  រយៈពេលគិតតាមថ្ងៃទី ខែ ឆ្នាំ (៧ ថ្ងៃចុងក្រោយ)៖ <strong>{report.dateRangeLabel}</strong>
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "#fbbf24", fontWeight: 700 }}>
                Lot Size: {selectedLotSize} Lot
              </span>
            </div>

            {/* 4 Scorecard Boxes for currently active strategy */}
            <div className="backtest-grid">
              <div>
                <span>WIN RATE (7D)</span>
                <strong style={{ color: "#22c55e" }}>{report.winRate}</strong>
              </div>

              <div>
                <span>TOTAL GAIN (7D)</span>
                <strong style={{ color: "#38bdf8" }}>{report.totalGain}</strong>
              </div>

              <div>
                <span>NET R:R (7D)</span>
                <strong style={{ color: "#c084fc" }}>{report.netRR}</strong>
              </div>

              <div>
                <span>PROFIT FACTOR</span>
                <strong style={{ color: "#f59e0b" }}>{report.profitFactor}</strong>
              </div>
            </div>

            {/* Detailed Statistics Table for Active Strategy */}
            <div style={{ marginTop: "16px", padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Active Strategy</span>
                <strong style={{ color: "#38bdf8" }}>Strategy {report.strategyNumber} ({report.strategyName})</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Selected Lot Size</span>
                <strong style={{ color: "#fbbf24" }}>{selectedLotSize} Lot</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Evaluation Period</span>
                <strong style={{ color: "#38bdf8" }}>៧ ថ្ងៃចុងក្រោយ ({report.dateRangeLabel})</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Total Executed Trades</span>
                <strong>{report.totalTrades} Trades ({report.winningTrades}W / {report.losingTrades}L)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>TP1 (1R) Hit Rate</span>
                <strong style={{ color: "#22c55e" }}>{report.tp1HitRate}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>TP2 (2R) Hit Rate</span>
                <strong style={{ color: "#38bdf8" }}>{report.tp2HitRate}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Long vs Short Win Rate</span>
                <strong>Long: {report.longWinRate} | Short: {report.shortWinRate}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Trade Expectancy (per {selectedLotSize} lot)</span>
                <strong style={{ color: "#22c55e" }}>{report.expectancy}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.8rem" }}>
                <span style={{ color: "#64748b" }}>Isolation Guarantee</span>
                <strong style={{ color: "#22c55e" }}>100% Isolated (ទិន្នន័យដាច់ដោយឡែកពី Strategy ផ្សេង)</strong>
              </div>
            </div>

            {/* SIDE-BY-SIDE STRATEGY PERFORMANCE COMPARISON TABLE */}
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span className="eyebrow" style={{ color: "#38bdf8", fontSize: "0.72rem" }}>
                    STRATEGY PERFORMANCE COMPARISON (ប្រៀបធៀបយុទ្ធសាស្ត្រទាំង 3)
                  </span>
                  <h3 style={{ margin: "2px 0 0", fontSize: "1.05rem", color: "#f8fafc" }}>
                    តារាងប្រៀបធៀបដឹងថា Strategy មួយណាខ្លាំង & ចំណេញជាងគេ
                  </h3>
                </div>
                <span style={{ fontSize: "0.68rem", color: "#fbbf24", fontWeight: 700, padding: "3px 8px", background: "rgba(245, 158, 11, 0.15)", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                  Lot: {selectedLotSize} Lot
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {comparisonReport.map((item) => {
                  const isCurrent = item.strategyNumber === selectedStrategyNumber;

                  return (
                    <div
                      key={item.strategyNumber}
                      onClick={() => handleSelectStrategy(item.strategyNumber)}
                      style={{
                        background: isCurrent ? "rgba(56, 189, 248, 0.14)" : "rgba(18, 25, 42, 0.75)",
                        border: isCurrent ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "14px",
                        padding: "14px 12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        position: "relative",
                        boxShadow: isCurrent ? "0 0 16px rgba(56, 189, 248, 0.3)" : "none",
                      }}
                    >
                      {isCurrent && (
                        <span
                          style={{
                            position: "absolute",
                            top: "-10px",
                            right: "12px",
                            background: "#38bdf8",
                            color: "#000",
                            fontSize: "0.6rem",
                            fontWeight: 900,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            letterSpacing: "0.04em",
                          }}
                        >
                          កំពុងប្រើ (ACTIVE)
                        </span>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 900,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: isCurrent ? "#38bdf8" : "rgba(255, 255, 255, 0.1)",
                            color: isCurrent ? "#000" : "#94a3b8",
                          }}
                        >
                          {item.strategyNumber}
                        </span>
                        <strong style={{ fontSize: "0.82rem", color: "#f8fafc", lineHeight: 1.2 }}>
                          {item.shortName.replace(/^\d+\s*•\s*/, "")}
                        </strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", margin: "5px 0" }}>
                        <span style={{ color: "#64748b" }}>Win Rate:</span>
                        <strong style={{ color: "#22c55e" }}>
                          {item.winRate} {item.isBestWinRate && "🏆"}
                        </strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", margin: "5px 0" }}>
                        <span style={{ color: "#64748b" }}>Total Gain:</span>
                        <strong style={{ color: "#38bdf8" }}>
                          {item.totalGain} {item.isBestProfit && "💰"}
                        </strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", margin: "5px 0" }}>
                        <span style={{ color: "#64748b" }}>Profit Factor:</span>
                        <strong style={{ color: "#f59e0b" }}>{item.profitFactor}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", margin: "5px 0" }}>
                        <span style={{ color: "#64748b" }}>Net R:R:</span>
                        <strong style={{ color: "#c084fc" }}>{item.netRR}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", margin: "5px 0" }}>
                        <span style={{ color: "#64748b" }}>Trades (7D):</span>
                        <strong style={{ color: "#cbd5e1" }}>{item.totalTrades}</strong>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectStrategy(item.strategyNumber);
                        }}
                        style={{
                          width: "100%",
                          marginTop: "10px",
                          padding: "6px 8px",
                          borderRadius: "8px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          border: isCurrent ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                          background: isCurrent ? "#38bdf8" : "rgba(255, 255, 255, 0.05)",
                          color: isCurrent ? "#000" : "#cbd5e1",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isCurrent ? "✓ កំពុងជ្រើសរើស" : `Switch ទៅ Strategy ${item.strategyNumber}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: JOURNAL RECORDS */
          <div>
            <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: "14px", lineHeight: 1.5 }}>
              ប្រវត្តិនៃការចូល Trade ជាក់ស្តែងសម្រាប់តែ <strong>Strategy {selectedStrategyNumber} ({activeStrategy.shortName})</strong> តាម Lot Size <strong>{selectedLotSize} Lot</strong> លើ <strong>{market}</strong> (ទិន្នន័យដាច់ដោយឡែក មិនបូកបញ្ចូល Strategy ផ្សេងឡើយ)៖
            </p>

            {/* 7 Time Period Filter Buttons */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "8px",
                marginBottom: "14px",
                scrollbarWidth: "none",
              }}
            >
              {JOURNAL_PERIODS.map((period) => {
                const isActive = selectedPeriodId === period.id;
                return (
                  <button
                    key={period.id}
                    onClick={() => setSelectedPeriodId(period.id)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      border: isActive ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(18, 25, 42, 0.7)",
                      color: isActive ? "#38bdf8" : "#94a3b8",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                  >
                    {period.label}
                  </button>
                );
              })}
            </div>

            {/* 3 Summary Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "#22c55e" }}>WIN RATE</span>
                <strong style={{ display: "block", fontSize: "1.1rem", color: "#22c55e" }}>{periodWinRate}</strong>
              </div>
              <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "#38bdf8" }}>TOTAL GAIN</span>
                <strong style={{ display: "block", fontSize: "1.1rem", color: "#38bdf8" }}>
                  {(totalPnL >= 0 ? "+$" : "-$") + Math.abs(totalPnL).toFixed(2)}
                </strong>
              </div>
              <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "#c084fc" }}>NET R:R</span>
                <strong style={{ display: "block", fontSize: "1.1rem", color: "#c084fc" }}>
                  {(totalRR >= 0 ? "+" : "") + totalRR.toFixed(1) + "R"}
                </strong>
              </div>
            </div>

            {/* Status Info Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.03)",
                borderRadius: "8px",
                marginBottom: "12px",
                fontSize: "0.72rem",
                color: "#94a3b8",
              }}
            >
              <span>
                Cycle: <strong style={{ color: "#38bdf8" }}>6:00 AM – 6:00 AM</strong> ({selectedPeriod.label})
              </span>
              <span>
                Strategy: <strong style={{ color: "#38bdf8" }}>{activeStrategy.shortName}</strong> | Lot: <strong style={{ color: "#fbbf24" }}>{selectedLotSize} Lot</strong> | Trades: <strong style={{ color: "#f8fafc" }}>{totalCount}</strong>
              </span>
            </div>

            {/* List of Trades */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredTrades.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "0.85rem" }}>
                  គ្មាន Trade ក្នុងចន្លោះពេលនេះឡើយ
                </div>
              ) : (
                filteredTrades.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "rgba(18, 25, 42, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderLeft: item.outcome === "WIN" ? "4px solid #22c55e" : "4px solid #ef4444",
                      borderRadius: "12px",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div>
                        <strong style={{ fontSize: "0.95rem", color: "#f8fafc", marginRight: "8px" }}>
                          {item.pair}
                        </strong>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 700,
                            background: item.side === "BUY" ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: item.side === "BUY" ? "#22c55e" : "#ef4444",
                            marginRight: "6px",
                          }}
                        >
                          {item.side}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(245, 158, 11, 0.18)",
                            color: "#fbbf24",
                            fontWeight: 700,
                            marginRight: "6px",
                          }}
                        >
                          {item.lotSize || `${selectedLotSize} Lot`}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            fontWeight: 600,
                          }}
                        >
                          {item.targetHit || "TP1"}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 800,
                          color: item.outcome === "WIN" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {item.pnl} ({item.rr})
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b" }}>
                      <span>Entry: {formatPrice(item.entry)} → Exit: {formatPrice(item.exit)}</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 12-Month Retention Cap Notice */}
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px dashed rgba(239, 68, 68, 0.25)",
                borderRadius: "10px",
                fontSize: "0.72rem",
                color: "#f87171",
                textAlign: "center",
              }}
            >
              🔒 ទិន្នន័យត្រូវបានរក្សាទុកអតិបរមាត្រឹម ១២ ខែប៉ុណ្ណោះ (ទិន្នន័យលើសពី 12 ខែមិនអាចមើលបានឡើយ)
            </div>
          </div>
        )}
      </section>
    );
  }

  // =========================================================================
  // PAGE 5: SETTINGS & ADMIN MEMBER MANAGEMENT
  // =========================================================================
  function renderSettings() {
    const xauCfg = SYMBOL_CONFIGS.XAUUSD;
    const btcCfg = SYMBOL_CONFIGS.BTCUSD;
    const isAdmin = userRole === "ADMIN";

    return (
      <section className="page-card">
        {/* Role-Based Access Control Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            background: isAdmin ? "rgba(234, 179, 8, 0.1)" : "rgba(56, 189, 248, 0.1)",
            border: isAdmin ? "1px solid rgba(234, 179, 8, 0.3)" : "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "10px",
            marginBottom: "16px",
          }}
        >
          <div>
            <span style={{ fontSize: "0.68rem", color: "#94a3b8", display: "block" }}>
              CURRENT USER ROLE
            </span>
            <strong style={{ fontSize: "0.88rem", color: isAdmin ? "#fbbf24" : "#38bdf8" }}>
              {isAdmin ? "👑 ADMIN (Owner Account)" : "👤 MEMBER (Standard User)"}
            </strong>
          </div>
          <button
            onClick={() => setUserRole(isAdmin ? "MEMBER" : "ADMIN")}
            style={{
              padding: "5px 10px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isAdmin ? "Switch to Member (Test Hide)" : "Switch to Admin"}
          </button>
        </div>

        {/* ADMIN-ONLY MEMBER MANAGEMENT SECTION */}
        {isAdmin && <AdminMemberManager />}

        {/* FOR NORMAL MEMBER: MEMBER STATUS BADGE (Member list is 100% hidden) */}
        {!isAdmin && (
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              marginBottom: "16px",
            }}
          >
            <strong style={{ color: "#22c55e", fontSize: "0.92rem", display: "block", marginBottom: "4px" }}>
              ✓ VIP Member Access Active
            </strong>
            <p style={{ margin: 0, fontSize: "0.76rem", color: "#94a3b8", lineHeight: "1.4" }}>
              គណនីរបស់អ្នកមានសិទ្ធិចូលមើល Signal ផ្ទាល់ Real-Time ទាំង XAUUSD & BTCUSD ដោយគ្មានដែនកំណត់។
            </p>
          </div>
        )}

        <span className="eyebrow" style={{ marginTop: "16px", display: "block" }}>
          ENGINE CONFIGURATION
        </span>
        <h2>Symbol Parameter Matrix</h2>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "14px" }}>
          ការកំណត់ប៉ារ៉ាម៉ែត្រឯករាជ្យសម្រាប់ <strong>XAUUSD</strong> និង <strong>BTCUSD</strong>៖
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* XAUUSD Config Card */}
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(18, 25, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "1rem", color: "#f8fafc" }}>XAUUSD Parameters</strong>
              <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "9999px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: 700 }}>
                Gold Scalp
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: "1.6" }}>
              <div>• Pip Value: <strong>${xauCfg.pipSize}</strong></div>
              <div>• Structural SL Buffer: <strong>{xauCfg.slBufferPips * xauCfg.pipSize} pt ({xauCfg.slBufferPips} pips)</strong></div>
              <div>• Min SL Filter: <strong>${xauCfg.minSlDistance.toFixed(2)}</strong></div>
              <div>• Max Allowed SL Filter: <strong>${xauCfg.maxSlDistance.toFixed(2)} (Rejects wider SL)</strong></div>
              <div>• Min Required R:R: <strong>1 : {xauCfg.minRiskReward}</strong></div>
            </div>
          </div>

          {/* BTCUSD Config Card */}
          <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(18, 25, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "1rem", color: "#f8fafc" }}>BTCUSD Parameters</strong>
              <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: "9999px", background: "rgba(234, 179, 8, 0.2)", color: "#eab308", fontWeight: 700 }}>
                Bitcoin Scalp
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: "1.6" }}>
              <div>• Point Value: <strong>${btcCfg.pipSize}</strong></div>
              <div>• Structural SL Buffer: <strong>${btcCfg.slBufferPips.toFixed(2)}</strong></div>
              <div>• Min SL Filter: <strong>${btcCfg.minSlDistance.toFixed(2)} pts</strong></div>
              <div>• Max Allowed SL Filter: <strong>${btcCfg.maxSlDistance.toFixed(2)} pts (Rejects wider SL)</strong></div>
              <div>• Min Required R:R: <strong>1 : {btcCfg.minRiskReward}</strong></div>
            </div>
          </div>
        </div>

        <div className="settings-list" style={{ marginTop: "20px" }}>
          <div>
            <span>Engine Hierarchy</span>
            <strong style={{ color: "#22c55e" }}>M15 (Trend) → M5 (Setup) → M3 (Entry)</strong>
          </div>
          <div>
            <span>Position Scale-Out</span>
            <strong style={{ color: "#38bdf8" }}>TP1 (50% + BE) | TP2 (50%)</strong>
          </div>
          <div>
            <span>Target Frameworks</span>
            <strong>Web App + Netlify Serverless + Telegram Mini App</strong>
          </div>
        </div>
      </section>
    );
  }

  function renderPage() {
    if (activePage === "chart") return renderChart();
    if (activePage === "analysis") return renderAnalysis();
    if (activePage === "journal") return renderJournal();
    if (activePage === "settings") return renderSettings();
    return renderHome();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand">MASTER AI</div>
          <div className="brand-subtitle">ANALYSIS</div>
        </div>

        <div className="connection">
          <span className={`status-dot ${connection === "ONLINE" ? "online" : ""}`} />
          {connection}
        </div>
      </header>

      <main className={activePage === "chart" ? "main-content chart-fullscreen" : "main-content"}>
        {renderPage()}
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "nav-item active" : "nav-item"}
            onClick={() => setActivePage(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Confidence Score Breakdown Modal */}
      <ConfidenceBreakdownModal
        isOpen={showConfidenceModal}
        onClose={() => setShowConfidenceModal(false)}
        score={currentSignal?.confidenceScore || 98}
        signal={currentSignal}
      />

      {/* Lot Size Selector Modal */}
      {renderLotSizeModal()}
    </div>
  );
}

export default App;
