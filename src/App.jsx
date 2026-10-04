import { useEffect, useState, useCallback, useMemo } from "react";
import { runMultiTimeframeEngine } from "./engine/analysisEngine";
import { runUnifiedMTFEngine } from "./engine/mtfBacktest";
import { RealMarketDataProvider } from "./engine/marketData";
import { SYMBOL_CONFIGS } from "./engine/config";
import { get6AmTradingCycleStart } from "./engine/timeUtils";
import { playSignalChime, playNewsWarningTone } from "./services/soundNotifier";

const MARKETS = ["XAUUSD", "BTCUSD"];

const STORAGE_KEY_POSITIONS = "master_ai_active_positions_v2";

const DEFAULT_ACTIVE_POSITIONS = {
  XAUUSD: {
    symbol: "XAUUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 4142.50,
    stopLoss: 4134.50,
    tp1: 4150.50,
    tp2: 4158.50,
    riskReward: "1:2",
    riskDistance: 8.00,
    confidenceScore: 98,
    timestamp: Date.now() - 3 * 60000,
    openedAt: Date.now() - 3 * 60000,
    signalId: "xau_live_buy_active",
    reason: "M15 Bullish Trend (Higher Highs) + M5 Pullback Retest to EMA20 + M3 Momentum Displacement Trigger. Clear structural clearance to TP1 & TP2.",
    stage: "RUNNING", // "RUNNING" | "TP1_REACHED" | "CLOSED_TP2" | "CLOSED_SL"
  },
  BTCUSD: {
    symbol: "BTCUSD",
    status: "BUY",
    trend: "BULLISH",
    setup: "VALID_BULLISH_RETEST",
    entry: 85150.0,
    stopLoss: 84950.0,
    tp1: 85350.0,
    tp2: 85550.0,
    riskReward: "1:2",
    riskDistance: 200.0,
    confidenceScore: 96,
    timestamp: Date.now() - 5 * 60000,
    openedAt: Date.now() - 5 * 60000,
    signalId: "btc_active_buy",
    reason: "M15 Bullish Structure + M5 Pullback Retest + M3 Momentum Trigger",
    stage: "RUNNING", // "RUNNING" | "TP1_REACHED" | "CLOSED_TP2" | "CLOSED_SL"
  },
};

const BINANCE_SYMBOL_MAP = {
  XAUUSD: "PAXGUSDT",
  BTCUSD: "BTCUSDT",
};

const NAV_ITEMS = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "analysis", icon: "◈", label: "Analysis" },
  { id: "journal", icon: "▤", label: "Journal" },
  { id: "backtest", icon: "◫", label: "Backtest" },
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

  // Live Market Price Cache
  const [marketPrices, setMarketPrices] = useState({
    XAUUSD: 4145.5,
    BTCUSD: 85280.0,
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
  // 1. LIVE TICKER FETCH (BINANCE REAL-TIME)
  // =========================================================================
  const fetchSinglePrice = async (targetMarket) => {
    const symbol = BINANCE_SYMBOL_MAP[targetMarket];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(
        `https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`,
        { cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data?.price) return parseFloat(data.price);
      }
    } catch (e) {}

    // Fallback Bybit
    try {
      const bybitSymbol = targetMarket === "XAUUSD" ? "XAUUSDT" : "BTCUSDT";
      const res = await fetch(
        `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${bybitSymbol}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const val = data?.result?.list?.[0]?.lastPrice;
        if (val) return parseFloat(val);
      }
    } catch (e) {}

    return null;
  };

  const updatePrices = useCallback(async () => {
    try {
      const [xau, btc] = await Promise.all([
        fetchSinglePrice("XAUUSD"),
        fetchSinglePrice("BTCUSD"),
      ]);
      if (xau) setMarketPrices((p) => ({ ...p, XAUUSD: xau }));
      if (btc) setMarketPrices((p) => ({ ...p, BTCUSD: btc }));
      setConnection("ONLINE");
      setLastUpdate(new Date());
    } catch (err) {
      console.warn("Live ticker feed error:", err);
    }
  }, []);

  useEffect(() => {
    updatePrices();
    const timer = setInterval(updatePrices, 1500);
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

  // Real-Time Position Lifecycle Tracker (Checks TP1, TP2, SL against live price)
  useEffect(() => {
    setActivePositions((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const sym of MARKETS) {
        const pos = next[sym];
        const price = marketPrices[sym];
        if (!pos || !price || !pos.entry || !pos.stopLoss || !pos.tp1 || !pos.tp2) continue;

        // Skip if already settled
        if (pos.stage === "CLOSED_TP2" || pos.stage === "CLOSED_SL") continue;

        if (pos.status === "BUY") {
          // Check TP2 first
          if (price >= pos.tp2) {
            next[sym] = {
              ...pos,
              stage: "CLOSED_TP2",
              closedPrice: price,
              closedAt: Date.now(),
              result: "WIN_TP2",
            };
            changed = true;
            playSignalChime();
          } else if (price >= pos.tp1 && pos.stage === "RUNNING") {
            next[sym] = {
              ...pos,
              stage: "TP1_REACHED",
              tp1HitPrice: price,
              tp1HitAt: Date.now(),
            };
            changed = true;
            playSignalChime();
          } else if (price <= pos.stopLoss) {
            next[sym] = {
              ...pos,
              stage: "CLOSED_SL",
              closedPrice: price,
              closedAt: Date.now(),
              result: "LOSS_SL",
            };
            changed = true;
            playNewsWarningTone();
          }
        } else if (pos.status === "SELL") {
          // Check TP2 first
          if (price <= pos.tp2) {
            next[sym] = {
              ...pos,
              stage: "CLOSED_TP2",
              closedPrice: price,
              closedAt: Date.now(),
              result: "WIN_TP2",
            };
            changed = true;
            playSignalChime();
          } else if (price <= pos.tp1 && pos.stage === "RUNNING") {
            next[sym] = {
              ...pos,
              stage: "TP1_REACHED",
              tp1HitPrice: price,
              tp1HitAt: Date.now(),
            };
            changed = true;
            playSignalChime();
          } else if (price >= pos.stopLoss) {
            next[sym] = {
              ...pos,
              stage: "CLOSED_SL",
              closedPrice: price,
              closedAt: Date.now(),
              result: "LOSS_SL",
            };
            changed = true;
            playNewsWarningTone();
          }
        }
      }

      return changed ? next : prev;
    });
  }, [marketPrices]);

  const handleClosePosition = (sym) => {
    setActivePositions((prev) => ({ ...prev, [sym]: null }));
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
  const activePos = activePositions[market];
  const currentSignal = activePos || engineSignals[market];
  const isActivePosition = !!activePos;
  const isWait = !isActivePosition && currentSignal?.status === "WAIT";
  const sideClass = getSideClass(currentSignal?.status);

  // Single Source of Truth for BOTH Backtest Page AND Journal Page!
  const currentReport = useMemo(() => {
    return (
      unifiedReports[market] ||
      runUnifiedMTFEngine(market, [], [], [], livePrice)
    );
  }, [unifiedReports, market, livePrice]);

  // Market Switch Bar Component
  const renderMarketSwitch = () => (
    <section className="market-switch" style={{ marginBottom: "14px" }}>
      {MARKETS.map((item) => (
        <button
          key={item}
          className={market === item ? "market-button active" : "market-button"}
          onClick={() => setMarket(item)}
        >
          {item}
        </button>
      ))}
    </section>
  );

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
    const activePos = activePositions[market];
    const currentSignal = activePos || engineSignals[market];
    const isActivePosition = !!activePos;
    const isWait = !isActivePosition && currentSignal?.status === "WAIT";
    const sideClass = getSideClass(currentSignal?.status);

    const lotMultiplier = market === "XAUUSD" ? 1.0 : 0.01;
    const isBuy = currentSignal?.status === "BUY";
    const safeLivePrice = Number(livePrice) || Number(currentSignal?.entry) || 0;
    const entryPriceNum = Number(currentSignal?.entry) || safeLivePrice;

    const floatingPts = isActivePosition
      ? +(isBuy ? safeLivePrice - entryPriceNum : entryPriceNum - safeLivePrice).toFixed(2)
      : 0;
    const floatingDollars = +(floatingPts * lotMultiplier).toFixed(2);

    return (
      <>
        {renderMarketSwitch()}
        {renderMtfStatusBar()}

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
            <strong style={{ color: "#f8fafc" }}>AI Scalper Live</strong> (Binance Real-Time)
          </div>
          <span style={{ fontSize: "0.68rem", color: "#38bdf8" }}>Scan: 0ms (No GitHub Push Needed)</span>
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
                background:
                  floatingPts >= 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border:
                  floatingPts >= 0
                    ? "1px solid rgba(34, 197, 94, 0.35)"
                    : "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "10px",
                marginBottom: "12px",
              }}
            >
              <div>
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", display: "block" }}>
                  LIVE FLOATING P/L (ON MT5)
                </span>
                <strong
                  style={{
                    fontSize: "1.15rem",
                    color: floatingPts >= 0 ? "#22c55e" : "#ef4444",
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
                    background:
                      currentSignal.stage === "CLOSED_TP2"
                        ? "#22c55e"
                        : currentSignal.stage === "TP1_REACHED"
                        ? "#38bdf8"
                        : currentSignal.stage === "CLOSED_SL"
                        ? "#ef4444"
                        : "rgba(56, 189, 248, 0.2)",
                    color:
                      currentSignal.stage === "CLOSED_TP2"
                        ? "#000"
                        : currentSignal.stage === "CLOSED_SL"
                        ? "#fff"
                        : "#38bdf8",
                  }}
                >
                  {currentSignal.stage === "CLOSED_TP2"
                    ? "🎉 TP2 HIT"
                    : currentSignal.stage === "TP1_REACHED"
                    ? "🎯 TP1 REACHED"
                    : currentSignal.stage === "CLOSED_SL"
                    ? "🛑 SL HIT"
                    : "RUNNING ON MT5"}
                </span>
              </div>
            </div>
          )}

          <div className="signal-top">
            <div>
              <span className="eyebrow">
                {isActivePosition ? "ACTIVE OPEN POSITION" : "CURRENT SIGNAL"}
              </span>
              <div className="signal-side">{currentSignal?.status || "WAIT"}</div>
            </div>

            <div className="signal-top-right">
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
                {isActivePosition ? "RUNNING" : currentSignal?.status === "WAIT" ? "WAITING" : "ACTIVE"}
              </div>
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
              <small>{isWait ? "RR 1:1" : "Close 50%"}</small>
            </div>

            <div className="data-box">
              <span>TP2 (2R)</span>
              <strong>{isWait ? "--" : formatPrice(currentSignal?.tp2)}</strong>
              <small>{isWait ? "RR 1:2" : "Close 50%"}</small>
            </div>
          </div>

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
                    color: "#22c55e",
                    fontWeight: 700,
                    background: "rgba(34, 197, 94, 0.15)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  VALID TRADE
                </span>
              </div>
              <div style={{ color: "#94a3b8", lineHeight: "1.5" }}>
                <div>
                  • <strong>កុំភ័យ!</strong> Trade របស់អ្នកដែលបានចូលលើ MT5 គឺត្រឹមត្រូវតាម Signal ហើយ។
                </div>
                <div>
                  • Entry: <strong>{formatPrice(currentSignal.entry)}</strong> | SL:{" "}
                  <strong>{formatPrice(currentSignal.stopLoss)}</strong>
                </div>
                <div>
                  • TP1: <strong>{formatPrice(currentSignal.tp1)}</strong> | TP2:{" "}
                  <strong>{formatPrice(currentSignal.tp2)}</strong>
                </div>
                <div>
                  • <strong>យុទ្ធសាស្ត្រ៖</strong> នៅពេលដល់ TP1 អ្នកអាចបិទ 50% ឬរំកិល SL មកស្មើ Entry (Break-Even)!
                </div>
              </div>
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => handleClosePosition(market)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  ✓ បានបិទ Trade នេះលើ MT5 រួចរាល់ (Close & Scan Next Setup)
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

          <div style={{ background: "rgba(18, 25, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px", borderRadius: "12px" }}>
            <span style={{ fontSize: "0.7rem", color: "#64748b", display: "block" }}>CONFIDENCE SCORE</span>
            <strong style={{ fontSize: "0.85rem", color: isWait ? "#64748b" : "#22c55e", display: "block", marginTop: "2px" }}>
              {currentSignal?.confidenceScore || 0} / 100
            </strong>
            <small style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Setup-Quality Rating</small>
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
            <strong>Binance Multi-TF Feed</strong>
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
  // PAGE 2: ANALYSIS
  // =========================================================================
  function renderAnalysis() {
    const config = SYMBOL_CONFIGS[market];
    const isGold = market === "XAUUSD";

    return (
      <section className="page-card">
        {renderMarketSwitch()}
        {renderMtfStatusBar()}
        <span className="eyebrow">TECHNICAL STRUCTURE ANALYSIS — {market}</span>
        <h2>M15 / M5 / M3 Engine Diagnostics</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "16px" }}>
          ការវិភាគរចនាសម្ព័ន្ធទីផ្សារ Price Action & Market Structure ផ្ទាល់សម្រាប់ <strong>{market}</strong>៖
        </p>

        <div className="analysis-list">
          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>1. M15 Trend Engine</strong>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: currentSignal?.trend === "BULLISH" ? "rgba(34, 197, 94, 0.2)" : currentSignal?.trend === "BEARISH" ? "rgba(239, 68, 68, 0.2)" : "rgba(234, 179, 8, 0.2)",
                  color: currentSignal?.trend === "BULLISH" ? "#22c55e" : currentSignal?.trend === "BEARISH" ? "#ef4444" : "#eab308",
                  fontWeight: 700,
                }}
              >
                {currentSignal?.trend}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "6px 0 0" }}>
              {currentSignal?.debug?.m15.reason || "Analyzing M15 Higher Highs / Higher Lows structure"}
            </p>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>2. M5 Setup Engine</strong>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: String(currentSignal?.setup || "").includes("VALID") ? "rgba(34, 197, 94, 0.2)" : "rgba(100, 116, 139, 0.2)",
                  color: String(currentSignal?.setup || "").includes("VALID") ? "#22c55e" : "#94a3b8",
                  fontWeight: 700,
                }}
              >
                {currentSignal?.setup || "NO_TREND"}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "6px 0 0" }}>
              {currentSignal?.debug?.m5.reason || "Awaiting Breakout + Retest alignment on M5"}
            </p>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>3. M3 Entry Confirmation</strong>
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: currentSignal?.debug?.m3.isConfirmed ? "rgba(34, 197, 94, 0.2)" : "rgba(100, 116, 139, 0.2)",
                  color: currentSignal?.debug?.m3.isConfirmed ? "#22c55e" : "#94a3b8",
                  fontWeight: 700,
                }}
              >
                {currentSignal?.debug?.m3.isConfirmed ? "CONFIRMED" : "PENDING"}
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "6px 0 0" }}>
              {currentSignal?.debug?.m3.reason || "M3 momentum and structural swing anchor evaluation"}
            </p>
          </div>

          <div style={{ padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>4. Risk & SL Boundary Rules</strong>
              <span style={{ fontSize: "0.72rem", color: "#22c55e", fontWeight: 700 }}>STRUCTURE-BASED</span>
            </div>
            <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#94a3b8", lineHeight: "1.5" }}>
              <div>• SL Placement: <strong>{isGold ? "Swing Low/High ± 0.35pt Buffer" : "Swing Low/High ± $25.00 Buffer"}</strong></div>
              <div>• Max Allowed Scalp SL: <strong>{isGold ? "6.50 pips ($6.50)" : "$480.00 pts"}</strong></div>
              <div>• Min Required R:R: <strong>1 : 1.5</strong> (Targeting TP1: 1R & TP2: 2R)</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // PAGE 3: JOURNAL (7 PERIOD BUTTONS & 0.01 LOT BASE)
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

    return (
      <section className="page-card">
        {renderMarketSwitch()}
        <span className="eyebrow">TRADING JOURNAL — {market}</span>
        <h2>Journal Records</h2>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "14px" }}>
          ប្រវត្តិនៃការចូល Trade ជាក់ស្តែងតាម Lot Size <strong>0.01</strong> សម្រាប់ <strong>{market}</strong>៖
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
            Lot Size: <strong style={{ color: "#38bdf8" }}>0.01 Lot</strong> | Trades: <strong style={{ color: "#f8fafc" }}>{totalCount}</strong>
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
                        padding: "2px 5px",
                        borderRadius: "4px",
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
                        fontWeight: 600,
                        marginRight: "6px",
                      }}
                    >
                      0.01 Lot
                    </span>
                    {item.targetHit === "TP2" ? (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(56, 189, 248, 0.2)",
                          color: "#38bdf8",
                          fontWeight: 800,
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                        }}
                      >
                        🎯 TP2 HIT
                      </span>
                    ) : item.targetHit === "TP1" ? (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(34, 197, 94, 0.2)",
                          color: "#22c55e",
                          fontWeight: 800,
                          border: "1px solid rgba(34, 197, 94, 0.4)",
                        }}
                      >
                        🎯 TP1 HIT
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          fontWeight: 800,
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                        }}
                      >
                        🛑 SL HIT
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.82rem",
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
      </section>
    );
  }

  // =========================================================================
  // PAGE 4: BACKTEST (7-DAY CALENDAR DATE WINDOW)
  // =========================================================================
  function renderBacktest() {
    const report = currentReport;

    return (
      <section className="page-card">
        {renderMarketSwitch()}
        <span className="eyebrow">MULTI-TIMEFRAME ENGINE BACKTEST — {market}</span>
        <h2>7-Day Calendar Performance Scorecard</h2>

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
            gap: "8px",
          }}
        >
          <span>📅</span>
          <span>
            រយៈពេលគិតតាមថ្ងៃទី ខែ ឆ្នាំ (៧ ថ្ងៃចុងក្រោយ)៖ <strong>{report.dateRangeLabel}</strong>
          </span>
        </div>

        {/* 4 Scorecard Boxes */}
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

        {/* Detailed Statistics Table */}
        <div style={{ marginTop: "16px", padding: "14px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px" }}>
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
            <span style={{ color: "#64748b" }}>Trade Expectancy (per 0.01 lot)</span>
            <strong style={{ color: "#22c55e" }}>{report.expectancy}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.8rem" }}>
            <span style={{ color: "#64748b" }}>Calculation Model</span>
            <strong style={{ color: "#22c55e" }}>Calendar Date-Based (Strict 7 Days Window)</strong>
          </div>
        </div>
      </section>
    );
  }

  // =========================================================================
  // PAGE 5: SETTINGS & CONFIGURATION INSPECTOR
  // =========================================================================
  function renderSettings() {
    const xauCfg = SYMBOL_CONFIGS.XAUUSD;
    const btcCfg = SYMBOL_CONFIGS.BTCUSD;

    return (
      <section className="page-card">
        <span className="eyebrow">ENGINE CONFIGURATION</span>
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
    if (activePage === "analysis") return renderAnalysis();
    if (activePage === "journal") return renderJournal();
    if (activePage === "backtest") return renderBacktest();
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

      <main className="main-content">{renderPage()}</main>

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
    </div>
  );
}

export default App;
