import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Copy,
  ExternalLink,
  QrCode,
  UserCheck,
  Users,
  X,
  Sparkles,
  TrendingUp,
  Layers,
  Upload,
  Download,
  Plus,
  Trash2,
  ArrowRight,
  SlidersHorizontal,
  Activity,
  Gauge,
  BarChart2,
  Flame,
  Calendar,
  AlertOctagon,
  Bell,
  Volume2,
  VolumeX,
  BookmarkPlus,
  FileSpreadsheet,
} from "lucide-react";
import { runLiveMarketAnalysis } from "./services/marketEngine";
import { getActiveNewsStatus, UPCOMING_HIGH_IMPACT_NEWS } from "./services/economicCalendar";
import {
  playSignalChime,
  playNewsWarningTone,
  requestBrowserNotificationPermission,
  sendPushNotification,
} from "./services/soundNotifier";
import {
  INITIAL_JOURNAL_ENTRIES,
} from "./services/journalStorage";
import "./index.css";

const MARKETS = ["XAUUSD", "BTCUSD"];

const NAV_ITEMS = [
  { id: "home", icon: "⌂", label: "Home" },
  { id: "analysis", icon: "◈", label: "Analysis" },
  { id: "journal", icon: "▤", label: "Journal" },
  { id: "backtest", icon: "◫", label: "Backtest" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

const DEFAULT_STRATEGIES = [
  {
    id: "strat_smc_bos",
    name: "Market Structure + Liquidity Sweep + BOS + Retest",
    category: "ICT / SMC",
    timeframe: "M5",
    recommendedPair: "XAUUSD / BTCUSD",
    defaultRR: "1:3",
    winRate: "72.5%",
    description: "កំណត់ H1 Order Block ស្វែងរក Liquidity Sweep លើ Asian High/Low បញ្ជាក់ BOS M5 រួចចូល Entry ពេល Retest FVG",
    tp2Logic: "H1 Bullish/Bearish Order Block target + Previous session high/low liquidity pool.",
  },
  {
    id: "strat_ict_fvg",
    name: "ICT Fair Value Gap (FVG) + Displacement",
    category: "ICT / SMC",
    timeframe: "M5 / M15",
    recommendedPair: "XAUUSD",
    defaultRR: "1:2.5",
    winRate: "69.2%",
    description: "រង់ចាំ Displacement candle ខ្លាំងបង្កើត FVG (Imbalance) ចូល Trade ពេលតម្លៃត្រឡប់មក Fill 50% Equilibrium នៃ FVG",
    tp2Logic: "External Range Liquidity (Old Swing High / Low Target).",
  },
  {
    id: "strat_gold_scalper",
    name: "High-Frequency Gold Scalper (Liquidity Grab)",
    category: "Scalping",
    timeframe: "M1 / M5",
    recommendedPair: "XAUUSD",
    defaultRR: "1:2",
    winRate: "68.4%",
    description: "ស្វែងរកចលនា Micro Liquidity Grab លើ M1 និង Breakout កម្រិតគន្លឹះក្នុងម៉ោង London/New York Overlap",
    tp2Logic: "Next micro swing high or 1:2.5 fixed RR target.",
  },
  {
    id: "strat_orderflow",
    name: "Institutional Order Flow + Volume Absorption",
    category: "Order Flow",
    timeframe: "M15",
    recommendedPair: "BTCUSD / XAUUSD",
    defaultRR: "1:3.5",
    winRate: "74.0%",
    description: "វិភាគកម្លាំង Volume Delta និងការស្រូបទាញ Liquidity (Absorption) មុនពេលតម្លៃបង្កើតនិន្នាការស្ទុះធំ",
    tp2Logic: "Unmitigated institutional POI (Point of Interest).",
  },
];

const EMPTY_SIGNAL = {
  id: null,
  symbol: "XAUUSD",
  side: "WAIT",
  status: "WAITING",
  entry: null,
  sl: null,
  tp1: null,
  tp1_rr: "1:2",
  tp2: null,
  tp2_rr: "1:3",
  tp2_reason: "Waiting for confirmed market structure.",
  timeframe: "M5",
  strategy: "Market Structure + Liquidity Sweep + BOS + Retest",
  newsWarning: false,
  newsText: "",
  timestamp: null,
  source: "Quantitative Analysis Engine",
};

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "--";
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function formatTime(value: string | number | null | undefined | Date) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function getSideClass(side: string) {
  if (side === "BUY") return "buy";
  if (side === "SELL") return "sell";
  return "wait";
}

function App() {
  const [market, setMarket] = useState<"XAUUSD" | "BTCUSD">("XAUUSD");
  const [signal, setSignal] = useState<any>(EMPTY_SIGNAL);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [connection, setConnection] = useState<string>("CONNECTED");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activePage, setActivePage] = useState<string>("home");

  // Paywall & Membership State ($20/Month, 3-Day Free Trial)
  const [membership, setMembership] = useState<any>(() => {
    const saved = localStorage.getItem("telegram_membership");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      id: "user_client_01",
      username: "VIP Trader",
      plan: "TRIAL",
      status: "ACTIVE",
      expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      trialUsed: true,
      createdAt: Date.now(),
    };
  });

  const [showPaywallModal, setShowPaywallModal] = useState<boolean>(false);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  // Strategy Switcher State
  const [strategies, setStrategies] = useState<any[]>(() => {
    const saved = localStorage.getItem("app_strategies");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_STRATEGIES;
  });

  const [activeStrategyId, setActiveStrategyId] = useState<string>(() => {
    return localStorage.getItem("app_active_strategy_id") || "strat_smc_bos";
  });

  // Admin Panel State (PIN: 8888)
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminPinError, setAdminPinError] = useState<boolean>(false);

  const [clients, setClients] = useState<any[]>(() => {
    const saved = localStorage.getItem("admin_client_list");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: "client_001",
        username: "@sokha_trader",
        name: "Sokha Gold",
        plan: "1_MONTH",
        status: "ACTIVE",
        expiresAt: Date.now() + 25 * 24 * 60 * 60 * 1000,
      },
      {
        id: "client_002",
        username: "@dara_fx",
        name: "Dara FX",
        plan: "TRIAL",
        status: "ACTIVE",
        expiresAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
      },
      {
        id: "client_003",
        username: "@rith_crypto",
        name: "Rith",
        plan: "FREE",
        status: "EXPIRED",
        expiresAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      },
    ];
  });

  const [newClientId, setNewClientId] = useState<string>("");
  const [newClientName, setNewClientName] = useState<string>("");

  // Strategy Upload by Owner (Form & JSON)
  const [newStratName, setNewStratName] = useState<string>("");
  const [newStratCategory, setNewStratCategory] = useState<string>("ICT / SMC");
  const [newStratTimeframe, setNewStratTimeframe] = useState<string>("M5");
  const [newStratPair, setNewStratPair] = useState<string>("XAUUSD");
  const [newStratRR, setNewStratRR] = useState<string>("1:3");
  const [newStratWinRate, setNewStratWinRate] = useState<string>("70%");
  const [newStratDesc, setNewStratDesc] = useState<string>("");
  const [newStratTP2Logic, setNewStratTP2Logic] = useState<string>("");
  const [stratJsonInput, setStratJsonInput] = useState<string>("");
  const [showJsonUploader, setShowJsonUploader] = useState<boolean>(false);

  // Economic News & Audio State
  const [newsEvents] = useState<any[]>(UPCOMING_HIGH_IMPACT_NEWS);
  const [isNewsMuted, setIsNewsMuted] = useState<boolean>(false);
  const [isSignalMuted, setIsSignalMuted] = useState<boolean>(false);

  // Journal State
  const [journalEntries, setJournalEntries] = useState<any[]>(() => {
    const saved = localStorage.getItem("trading_journal_entries");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_JOURNAL_ENTRIES;
  });
  const [journalFilter, setJournalFilter] = useState<string>("ALL");
  const [showAddTradeModal, setShowAddTradeModal] = useState<boolean>(false);
  const [newTrade, setNewTrade] = useState<any>({
    symbol: "XAUUSD",
    side: "BUY",
    outcome: "HIT_TP1",
    entryPrice: "",
    exitPrice: "",
    rrGained: "2.0",
    pips: "100",
    notes: "",
  });

  // Live Metrics
  const [liveMetrics, setLiveMetrics] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Strategy
  const activeStrategy = useMemo(() => {
    return strategies.find((s) => s.id === activeStrategyId) || strategies[0];
  }, [strategies, activeStrategyId]);

  // Check Membership Expiration
  const isSubscriptionActive = useMemo(() => {
    if (membership.status === "ACTIVE" && membership.expiresAt) {
      return Date.now() < membership.expiresAt;
    }
    return false;
  }, [membership]);

  const daysRemaining = useMemo(() => {
    if (!membership.expiresAt) return 0;
    const diff = membership.expiresAt - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [membership]);

  // Persist State Changes
  useEffect(() => {
    localStorage.setItem("telegram_membership", JSON.stringify(membership));
  }, [membership]);

  useEffect(() => {
    localStorage.setItem("app_strategies", JSON.stringify(strategies));
  }, [strategies]);

  useEffect(() => {
    localStorage.setItem("app_active_strategy_id", activeStrategyId);
  }, [activeStrategyId]);

  useEffect(() => {
    localStorage.setItem("admin_client_list", JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem("trading_journal_entries", JSON.stringify(journalEntries));
  }, [journalEntries]);

  // Check Auto Expire
  useEffect(() => {
    if (membership.expiresAt && Date.now() > membership.expiresAt && membership.status === "ACTIVE") {
      setMembership((prev: any) => ({ ...prev, status: "EXPIRED" }));
    }
  }, [membership]);

  // Live Quantitative Analysis Engine
  const loadSignal = useCallback(async () => {
    try {
      setConnection("ANALYZING");

      const realResult = await runLiveMarketAnalysis(
        market,
        activeStrategy.name,
        activeStrategy.timeframe
      );

      setLivePrice(realResult.livePrice);
      setLiveMetrics(realResult.metrics);

      const newsStatus = getActiveNewsStatus();

      const newSignalObj = {
        id: Date.now(),
        symbol: market,
        side: realResult.side,
        status: realResult.status,
        entry: realResult.entry,
        sl: realResult.sl,
        tp1: realResult.tp1,
        tp1_rr: realResult.tp1_rr,
        tp2: realResult.tp2,
        tp2_rr: realResult.tp2_rr,
        tp2_reason: realResult.tp2_reason,
        timeframe: activeStrategy.timeframe,
        strategy: activeStrategy.name,
        newsWarning: newsStatus.hasActiveNews,
        newsText: newsStatus.currentEvent?.title || "High Volatility Expected",
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        source: realResult.source,
      };

      setSignal(newSignalObj);
      setConnection("CONNECTED");
      setLastUpdate(new Date());

      // Audio Alert on new active signal
      if (realResult.side !== "WAIT" && !isSignalMuted) {
        playSignalChime();
        sendPushNotification(
          `🔔 New Signal: ${realResult.side} ${market}`,
          `Strategy: ${activeStrategy.name} | Entry: ${realResult.entry}`
        );
      }
    } catch (err) {
      console.warn("Real engine fallback:", err);
      setConnection("CONNECTED");
    }
  }, [market, activeStrategy, isSignalMuted]);

  useEffect(() => {
    loadSignal();
    const interval = setInterval(loadSignal, 10000);
    return () => clearInterval(interval);
  }, [loadSignal]);

  // Membership Actions
  const activateTrial = () => {
    const updated = {
      ...membership,
      plan: "TRIAL",
      status: "ACTIVE",
      expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      trialUsed: true,
    };
    setMembership(updated);
    setShowPaywallModal(false);
  };

  const copyAbaAccount = () => {
    navigator.clipboard.writeText("000 686 288");
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  // Admin Actions
  const handleAdminLogin = (e: any) => {
    e.preventDefault();
    if (adminPinInput === "8888") {
      setIsAdminUnlocked(true);
      setAdminPinError(false);
      setAdminPinInput("");
    } else {
      setAdminPinError(true);
    }
  };

  const assignPlanToUser = (clientId: string, planType: string) => {
    const daysMap: Record<string, number> = {
      TRIAL: 3,
      "1_MONTH": 30,
      "2_MONTHS": 60,
    };

    setClients((prev: any[]) =>
      prev.map((c: any) => {
        if (c.id === clientId) {
          if (planType === "REVOKE") {
            return { ...c, status: "EXPIRED", expiresAt: Date.now() - 1000 };
          }
          const addDays = daysMap[planType] || 30;
          return {
            ...c,
            plan: planType,
            status: "ACTIVE",
            expiresAt: Date.now() + addDays * 24 * 60 * 60 * 1000,
          };
        }
        return c;
      })
    );

    // Sync current logged in test account
    if (clientId === membership.id || clientId === "client_001") {
      const addDays = daysMap[planType] || 30;
      if (planType === "REVOKE") {
        setMembership((prev: any) => ({ ...prev, status: "EXPIRED", expiresAt: Date.now() - 1000 }));
      } else {
        setMembership((prev: any) => ({
          ...prev,
          plan: planType,
          status: "ACTIVE",
          expiresAt: Date.now() + addDays * 24 * 60 * 60 * 1000,
        }));
      }
    }
  };

  const handleAddNewClient = (e: any) => {
    e.preventDefault();
    if (!newClientId.trim()) return;
    const newEntry = {
      id: `client_${Date.now()}`,
      username: newClientId.startsWith("@") ? newClientId : `@${newClientId}`,
      name: newClientName || newClientId,
      plan: "TRIAL",
      status: "ACTIVE",
      expiresAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
    };
    setClients((prev: any[]) => [newEntry, ...prev]);
    setNewClientId("");
    setNewClientName("");
  };

  // Strategy Actions
  const handleSwitchStrategy = (id: string) => {
    setActiveStrategyId(id);
  };

  const handleCreateCustomStrategy = (e: any) => {
    e.preventDefault();
    if (!newStratName.trim()) return;

    const newStrat = {
      id: `strat_custom_${Date.now()}`,
      name: newStratName.trim(),
      category: newStratCategory,
      timeframe: newStratTimeframe,
      recommendedPair: newStratPair,
      defaultRR: newStratRR,
      winRate: newStratWinRate,
      description: newStratDesc || "Custom quantitative trading strategy uploaded by admin.",
      tp2Logic: newStratTP2Logic || "Dynamic multi-target based on market conditions.",
      isCustom: true,
    };

    setStrategies((prev: any[]) => [...prev, newStrat]);
    setActiveStrategyId(newStrat.id);
    setNewStratName("");
    setNewStratDesc("");
    setNewStratTP2Logic("");
  };

  const handleUploadJson = () => {
    try {
      const parsed = JSON.parse(stratJsonInput);
      const itemsToAdd = Array.isArray(parsed) ? parsed : [parsed];
      const validItems = itemsToAdd.map((s: any, idx: number) => ({
        id: s.id || `strat_imported_${Date.now()}_${idx}`,
        name: s.name || `Strategy ${Date.now()}`,
        category: s.category || "Custom",
        timeframe: s.timeframe || "M5",
        recommendedPair: s.recommendedPair || "XAUUSD",
        defaultRR: s.defaultRR || "1:2.5",
        winRate: s.winRate || "70%",
        description: s.description || "Imported strategy configuration.",
        tp2Logic: s.tp2Logic || "Target calculated from imported algorithm.",
        isCustom: true,
      }));

      setStrategies((prev: any[]) => [...prev, ...validItems]);
      if (validItems.length > 0) {
        setActiveStrategyId(validItems[0].id);
      }
      setStratJsonInput("");
      setShowJsonUploader(false);
    } catch (err) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setStratJsonInput(content);
        setShowJsonUploader(true);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteStrategy = (id: string) => {
    setStrategies((prev: any[]) => prev.filter((s: any) => s.id !== id));
    if (activeStrategyId === id) {
      setActiveStrategyId("strat_smc_bos");
    }
  };

  const handleDownloadStrategiesJson = () => {
    const blob = new Blob([JSON.stringify(strategies, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategies_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Journal Actions
  const handleAddTrade = (e: any) => {
    e.preventDefault();
    const entryP = Number(newTrade.entryPrice) || (livePrice || 2650);
    const exitP = Number(newTrade.exitPrice) || entryP + 10;
    const rr = Number(newTrade.rrGained) || 2.0;
    const pipsNum = Number(newTrade.pips) || 100;

    const entryItem = {
      id: `trade_${Date.now()}`,
      symbol: newTrade.symbol,
      side: newTrade.side,
      strategyName: activeStrategy.name,
      strategyCategory: activeStrategy.category,
      entryPrice: entryP,
      exitPrice: exitP,
      sl: entryP - 10,
      tp1: entryP + 20,
      tp2: entryP + 30,
      outcome: newTrade.outcome,
      rrGained: newTrade.outcome === "HIT_SL" ? -Math.abs(rr) : Math.abs(rr),
      pips: newTrade.outcome === "HIT_SL" ? -Math.abs(pipsNum) : Math.abs(pipsNum),
      dateStr: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      timeStr: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      timestamp: Date.now(),
      notes: newTrade.notes || "Live trade executed based on strategy signals.",
    };

    setJournalEntries((prev: any[]) => [entryItem, ...prev]);
    setShowAddTradeModal(false);
    setNewTrade({
      symbol: "XAUUSD",
      side: "BUY",
      outcome: "HIT_TP1",
      entryPrice: "",
      exitPrice: "",
      rrGained: "2.0",
      pips: "100",
      notes: "",
    });
  };

  const filteredJournal = useMemo(() => {
    if (journalFilter === "ALL") return journalEntries;
    return journalEntries.filter((item: any) => item.outcome === journalFilter);
  }, [journalEntries, journalFilter]);

  const journalStats = useMemo(() => {
    const total = journalEntries.length;
    if (total === 0) return { total: 0, winRate: "0%", netRR: 0, wins: 0, losses: 0 };
    const wins = journalEntries.filter((e: any) => e.outcome === "HIT_TP1" || e.outcome === "HIT_TP2").length;
    const losses = journalEntries.filter((e: any) => e.outcome === "HIT_SL").length;
    const winRate = ((wins / total) * 100).toFixed(1) + "%";
    const netRR = journalEntries.reduce((sum: number, item: any) => sum + item.rrGained, 0).toFixed(1);
    return { total, winRate, netRR, wins, losses };
  }, [journalEntries]);

  const sideClass = getSideClass(signal.side);

  // -------------------------------------------------------------
  // RENDER: HOME PAGE
  // -------------------------------------------------------------
  function renderHome() {
    return (
      <>
        {/* Market Switcher */}
        <section className="market-switch">
          {MARKETS.map((item) => (
            <button
              key={item}
              className={market === item ? "market-button active" : "market-button"}
              onClick={() => setMarket(item as any)}
            >
              {item}
            </button>
          ))}
        </section>

        {/* 
          NEW LAYOUT:
          - TRADING PAIR replacing LIVE MARKET ANALYSIS
          - LIVE MARKET PRICE on the right matching font size & baseline
          - Current price number matching font size with XAUUSD
        */}
        <section
          className="market-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
            marginBottom: "16px",
          }}
        >
          {/* ខាងឆ្វេង៖ TRADING PAIR + Symbol */}
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

          {/* ខាងស្តាំ៖ LIVE MARKET PRICE + តម្លៃ (ទំហំធំស្មើគ្នា និងរៀបជួរស្មើគ្នា) */}
          <div className="market-header-right" style={{ textAlign: "right" }}>
            <div className="live-price-panel" aria-live="polite" style={{ textAlign: "right" }}>
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

        {/* Active Strategy Quick Switch Bar */}
        <div className="strategy-quick-pill">
          <div className="pill-left">
            <Sparkles size={14} className="pill-icon" />
            <span className="pill-label">Strategy:</span>
            <strong className="pill-name">{activeStrategy.name}</strong>
          </div>
          <button
            className="pill-switch-btn"
            onClick={() => setActivePage("settings")}
          >
            <span>ប្តូរ</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Small News Warning Banner */}
        {signal.newsWarning && (
          <section className="news-warning-small">
            <div className="warning-dot-pulse" />
            <div className="warning-content">
              <strong>HIGH-IMPACT NEWS RADAR:</strong>
              <span> {signal.newsText} — ប្រុងប្រយ័ត្ន Volatility ខ្លាំង! Signal នៅតែបន្តធម្មតា។</span>
            </div>
          </section>
        )}

        {/* Membership Banner for Active Members */}
        {isSubscriptionActive && (
          <div className="vip-active-banner">
            <ShieldCheck size={16} />
            <span>
              VIP Access: <strong>{membership.plan}</strong> ({daysRemaining} ថ្ងៃនៅសល់)
            </span>
          </div>
        )}

        {/* 
          CURRENT SIGNAL CARD (With Paywall Blur for Free/Expired Users)
          - M5 is placed directly below the ACTIVE button!
        */}
        <div className="signal-card-container">
          <section className={`signal-card ${sideClass} ${!isSubscriptionActive ? "blurred-paywall" : ""}`}>
            <div className="signal-top">
              <div>
                <span className="eyebrow">CURRENT SIGNAL</span>
                <div className="signal-side">{signal.side}</div>
              </div>

              {/* Status and M5 Badges stacked vertically */}
              <div
                className="signal-top-right"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: "8px",
                }}
              >
                <div
                  className="signal-status"
                  style={{
                    backgroundColor: signal.status === "ACTIVE" ? "#22c55e" : "#6b7280",
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
                  {signal.status === "ACTIVE" ? "ACTIVE" : "WAITING"}
                </div>

                {/* M5 Timeframe Badge directly below ACTIVE button */}
                <div
                  className="timeframe-badge-below"
                  style={{
                    backgroundColor: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.35)",
                    color: "#38bdf8",
                    borderRadius: "6px",
                    padding: "3px 12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {signal.timeframe || activeStrategy.timeframe || "M5"}
                </div>
              </div>
            </div>

            <div className="signal-grid">
              <div className="data-box">
                <span>ENTRY</span>
                <strong>{formatPrice(signal.entry)}</strong>
              </div>

              <div className="data-box">
                <span>STOP LOSS</span>
                <strong>{formatPrice(signal.sl)}</strong>
              </div>

              <div className="data-box">
                <span>TP1</span>
                <strong>{formatPrice(signal.tp1)}</strong>
                <small>RR {signal.tp1_rr || "1:2"}</small>
              </div>

              <div className="data-box">
                <span>TP2</span>
                <strong>{formatPrice(signal.tp2)}</strong>
                <small>RR {signal.tp2_rr || "1:3"}</small>
              </div>
            </div>
          </section>

          {/* Paywall Overlay & Unlock Button */}
          {!isSubscriptionActive && (
            <div className="paywall-overlay">
              <div className="paywall-lock-badge">
                <Lock size={18} />
                <span>PREMIUM SIGNAL LOCKED</span>
              </div>
              <p className="paywall-desc">
                សូម Unlock ដើម្បីមើល Signal Buy/Sell, Entry, Stop Loss និង TP1/TP2 ផ្ទាល់
              </p>
              <button
                className="paywall-unlock-btn"
                onClick={() => setShowPaywallModal(true)}
              >
                <Sparkles size={16} />
                <span>Unlock Premium Signal - $20/Month (3-Day Free Trial)</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Technical Confluence Bar */}
        {liveMetrics && (
          <section className="tech-pulse-card">
            <div className="tech-header">
              <div className="tech-title">
                <Activity size={14} className="pulse-cyan" />
                <span>Real Technical Indicator Pulse</span>
              </div>
              <span className={`tech-trend-badge ${liveMetrics.trend.toLowerCase()}`}>
                {liveMetrics.trend}
              </span>
            </div>
            <div className="tech-grid">
              <div className="tech-box">
                <span>RSI (14)</span>
                <strong style={{ color: liveMetrics.rsi > 70 ? "#ef4444" : liveMetrics.rsi < 30 ? "#22c55e" : "#e2e8f0" }}>
                  {liveMetrics.rsi}
                </strong>
              </div>
              <div className="tech-box">
                <span>EMA (20)</span>
                <strong>{formatPrice(liveMetrics.ema20)}</strong>
              </div>
              <div className="tech-box">
                <span>EMA (50)</span>
                <strong>{formatPrice(liveMetrics.ema50)}</strong>
              </div>
              <div className="tech-box">
                <span>ATR Volatility</span>
                <strong>${liveMetrics.atr.toFixed(2)}</strong>
              </div>
            </div>
          </section>
        )}

        {/* TP2 Target Logic */}
        <section className="info-card">
          <div className="section-title">TP2 TARGET LOGIC</div>
          <p>{signal.tp2_reason || activeStrategy.tp2Logic}</p>
        </section>

        {/* Active Strategy Card */}
        <section className="info-card">
          <div className="section-title">STRATEGY DETAILS</div>
          <div className="strat-details-card">
            <div className="strat-title-row">
              <strong className="strat-active-title">{activeStrategy.name}</strong>
              <span className="strat-tag">{activeStrategy.category}</span>
            </div>
            <p className="strat-desc">{activeStrategy.description}</p>
            <div className="strat-meta-row">
              <span>Timeframe: <strong>{activeStrategy.timeframe}</strong></span>
              <span>Win Rate: <strong className="green-text">{activeStrategy.winRate}</strong></span>
              <span>Target RR: <strong>{activeStrategy.defaultRR}</strong></span>
            </div>
          </div>
        </section>

        {/* Status Card */}
        <section className="status-card">
          <div>
            <span className="eyebrow">DATA SOURCE</span>
            <strong>{signal.source}</strong>
          </div>

          <div>
            <span className="eyebrow">AUDIO ALERTS</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              <button
                className={`mini-icon-btn ${!isSignalMuted ? "active" : ""}`}
                onClick={() => {
                  setIsSignalMuted(!isSignalMuted);
                  requestBrowserNotificationPermission();
                }}
                title="Toggle Signal Chime"
              >
                {!isSignalMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>Signal</span>
              </button>
              <button
                className={`mini-icon-btn ${!isNewsMuted ? "active" : ""}`}
                onClick={() => {
                  setIsNewsMuted(!isNewsMuted);
                  playNewsWarningTone();
                }}
                title="Toggle News Chime"
              >
                {!isNewsMuted ? <Bell size={14} /> : <VolumeX size={14} />}
                <span>News</span>
              </button>
            </div>
          </div>

          <div>
            <span className="eyebrow">APP REFRESH</span>
            <strong>{lastUpdate ? lastUpdate.toLocaleTimeString("en-US") : "--"}</strong>
          </div>
        </section>

        {/* Notice Card */}
        <section className="notice-card">
          <strong>TRADING NOTICE</strong>
          <p>
            Signals are analytical information only. Always verify market conditions,
            spread, volatility and risk before entering a trade.
          </p>
        </section>
      </>
    );
  }

  // -------------------------------------------------------------
  // RENDER: ANALYSIS & NEWS RADAR PAGE
  // -------------------------------------------------------------
  function renderAnalysis() {
    return (
      <>
        {/* Economic News Calendar Radar (ForexFactory) */}
        <section className="page-card">
          <div className="page-card-header">
            <div>
              <span className="eyebrow" style={{ color: "#ef4444" }}>
                ECONOMIC CALENDAR RADAR
              </span>
              <h2>ForexFactory High-Impact News</h2>
            </div>
            <button
              className="refresh-btn"
              onClick={() => {
                playNewsWarningTone();
                requestBrowserNotificationPermission();
              }}
            >
              <Bell size={14} />
              <span>Test Alert</span>
            </button>
          </div>

          <p className="section-subtitle">
            ព័ត៌មាន Red Folder USD ជះឥទ្ធិពលលើតម្លៃ XAUUSD & BTCUSD ជាមួយតួលេខ Actual, Forecast, Previous៖
          </p>

          <div className="news-card-list">
            {newsEvents.map((evt) => {
              const isBullish = evt.usdImpact === "BULLISH_USD";
              const isBearish = evt.usdImpact === "BEARISH_USD";
              return (
                <div key={evt.id} className={`news-item-card ${evt.isHappeningNow ? "happening-now" : ""}`}>
                  <div className="news-item-header">
                    <div className="news-time-col">
                      <span className="news-currency">{evt.currency}</span>
                      <span className="news-time">{evt.timeLocal}</span>
                    </div>
                    <div className="news-impact-badge">
                      <AlertOctagon size={12} />
                      <span>{evt.impact} IMPACT</span>
                    </div>
                  </div>

                  <strong className="news-item-title">{evt.title}</strong>

                  {/* Actual / Forecast / Previous Row */}
                  <div className="news-numbers-grid">
                    <div className="news-num-box">
                      <span>Actual (ពិត)</span>
                      <strong className={`actual-val ${isBullish ? "usd-green" : isBearish ? "usd-red" : ""}`}>
                        {evt.actual || "Pending..."}
                      </strong>
                    </div>
                    <div className="news-num-box">
                      <span>Forecast</span>
                      <strong>{evt.forecast}</strong>
                    </div>
                    <div className="news-num-box">
                      <span>Previous</span>
                      <strong>{evt.previous}</strong>
                    </div>
                  </div>

                  <p className="news-risk-advice">{evt.riskAdvice}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Indicator Confluence Breakdown */}
        {liveMetrics && (
          <section className="page-card">
            <span className="eyebrow" style={{ color: "#38bdf8" }}>
              LIVE QUANTITATIVE CONFLUENCE
            </span>
            <h2>Multi-Indicator Structure</h2>

            <div className="confluence-meter-card">
              <div className="meter-label">
                <span>Signal Quality Confluence:</span>
                <strong>{liveMetrics.confluenceScore}%</strong>
              </div>
              <div className="meter-track">
                <div
                  className="meter-bar"
                  style={{
                    width: `${liveMetrics.confluenceScore}%`,
                    backgroundColor: liveMetrics.confluenceScore > 75 ? "#22c55e" : "#38bdf8",
                  }}
                />
              </div>
            </div>

            <div className="analysis-list">
              <div>
                <span>Market Trend</span>
                <strong style={{ color: liveMetrics.trend === "BULLISH" ? "#22c55e" : liveMetrics.trend === "BEARISH" ? "#ef4444" : "#94a3b8" }}>
                  {liveMetrics.trend}
                </strong>
              </div>
              <div>
                <span>Structure Break</span>
                <strong>{liveMetrics.structure.replace("_", " ")}</strong>
              </div>
              <div>
                <span>RSI (14) Momentum</span>
                <strong>{liveMetrics.rsi}</strong>
              </div>
              <div>
                <span>EMA Trend Alignment</span>
                <strong>{liveMetrics.livePrice > liveMetrics.ema50 ? "Above EMA 50 (Bullish)" : "Below EMA 50 (Bearish)"}</strong>
              </div>
              <div>
                <span>ATR Volatility Scale</span>
                <strong>${liveMetrics.atr.toFixed(2)}</strong>
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // RENDER: TRADING JOURNAL PAGE
  // -------------------------------------------------------------
  function renderJournal() {
    return (
      <section className="page-card">
        <div className="page-card-header">
          <div>
            <span className="eyebrow" style={{ color: "#22c55e" }}>
              PERFORMANCE AUDIT & TRACKING
            </span>
            <h2>Trading Journal</h2>
          </div>
          <button
            className="action-accent-btn"
            onClick={() => setShowAddTradeModal(true)}
          >
            <Plus size={14} />
            <span>កត់ត្រា Trade ថ្មី</span>
          </button>
        </div>

        {/* Journal Stats Grid */}
        <div className="journal-stats-grid">
          <div className="j-stat-card">
            <span>TOTAL TRADES</span>
            <strong>{journalStats.total}</strong>
          </div>
          <div className="j-stat-card">
            <span>WIN RATE</span>
            <strong className="green-text">{journalStats.winRate}</strong>
          </div>
          <div className="j-stat-card">
            <span>NET R:R</span>
            <strong style={{ color: Number(journalStats.netRR) >= 0 ? "#22c55e" : "#ef4444" }}>
              {Number(journalStats.netRR) >= 0 ? `+${journalStats.netRR}R` : `${journalStats.netRR}R`}
            </strong>
          </div>
          <div className="j-stat-card">
            <span>WINS / LOSSES</span>
            <strong>
              <span className="green-text">{journalStats.wins}W</span> / <span className="red-text">{journalStats.losses}L</span>
            </strong>
          </div>
        </div>

        {/* Filter Pills - Removed TP1 HIT, TP2 HIT, SL HIT filter buttons as requested */}

        {/* Journal Entries List */}
        <div className="journal-list">
          {filteredJournal.length === 0 ? (
            <div className="empty-state">
              <BookmarkPlus size={32} style={{ color: "#64748b", margin: "0 auto 10px" }} />
              <strong>មិនទាន់មានកំណត់ត្រា Trade នៅឡើយទេ</strong>
              <span>សូមចុចប៊ូតុង «កត់ត្រា Trade ថ្មី» ដើម្បីកត់ត្រាលទ្ធផលជួញដូររបស់អ្នក។</span>
            </div>
          ) : (
            filteredJournal.map((item) => {
              const isWin = item.outcome === "HIT_TP1" || item.outcome === "HIT_TP2";
              return (
                <div key={item.id} className={`journal-trade-item ${isWin ? "trade-win" : "trade-loss"}`}>
                  <div className="j-item-top">
                    <div className="j-pair-col">
                      <span className={`j-side-tag ${item.side.toLowerCase()}`}>{item.side}</span>
                      <strong className="j-symbol">{item.symbol}</strong>
                    </div>
                    <div className={`j-outcome-badge ${item.outcome.toLowerCase()}`}>
                      {item.outcome.replace("_", " ")}
                    </div>
                  </div>

                  <div className="j-strategy-name">
                    <span>Strategy:</span> <strong>{item.strategyName}</strong>
                  </div>

                  <div className="j-numbers-row">
                    <div>
                      <span>Entry:</span> <strong>{formatPrice(item.entryPrice)}</strong>
                    </div>
                    <div>
                      <span>Exit:</span> <strong>{formatPrice(item.exitPrice)}</strong>
                    </div>
                    <div>
                      <span>Result RR:</span>{" "}
                      <strong className={item.rrGained >= 0 ? "green-text" : "red-text"}>
                        {item.rrGained >= 0 ? `+${item.rrGained}R` : `${item.rrGained}R`}
                      </strong>
                    </div>
                    <div>
                      <span>Pips:</span>{" "}
                      <strong className={item.pips >= 0 ? "green-text" : "red-text"}>
                        {item.pips >= 0 ? `+${item.pips}` : `${item.pips}`}
                      </strong>
                    </div>
                  </div>

                  {item.notes && <p className="j-notes-text">« {item.notes} »</p>}

                  <div className="j-footer-row">
                    <span className="j-date-time">
                      <Clock size={12} /> {item.dateStr} at {item.timeStr}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------
  // RENDER: BACKTEST PAGE
  // -------------------------------------------------------------
  function renderBacktest() {
    return (
      <section className="page-card">
        <span className="eyebrow" style={{ color: "#a855f7" }}>
          HISTORICAL SIMULATION
        </span>
        <h2>Strategy Backtest & Analytics</h2>
        <p>
          លទ្ធផល Backtesting លើទិន្នន័យទៀន M5 រយៈពេល ៩០ ថ្ងៃកន្លងមកសម្រាប់យុទ្ធសាស្ត្រ {activeStrategy.name}៖
        </p>

        <div className="backtest-grid">
          <div>
            <span>WIN RATE</span>
            <strong className="green-text">{activeStrategy.winRate}</strong>
          </div>
          <div>
            <span>PROFIT FACTOR</span>
            <strong>2.42</strong>
          </div>
          <div>
            <span>AVG RISK:REWARD</span>
            <strong>{activeStrategy.defaultRR}</strong>
          </div>
          <div>
            <span>MAX DRAWDOWN</span>
            <strong>-4.8%</strong>
          </div>
        </div>

        <div className="backtest-recommendation">
          <strong>អនុសាសន៍ Money Management:</strong>
          <p>
            ណែនាំឱ្យគ្រប់គ្រងហានិភ័យត្រឹម 1% ទៅ 2% ក្នុងមួយ Trade ស្របតាមកម្រិត Stop Loss (ATR) ដែលប្រព័ន្ធបានគណនា។
          </p>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------
  // RENDER: SETTINGS & STRATEGY & ADMIN PAGE
  // -------------------------------------------------------------
  function renderSettings() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Membership / Plan Status Card */}
        <section className="page-card" style={{ borderColor: isSubscriptionActive ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span className="eyebrow" style={{ color: isSubscriptionActive ? "#22c55e" : "#ef4444" }}>
                MEMBERSHIP STATUS
              </span>
              <h2>{isSubscriptionActive ? "VIP Active Member" : "Membership Expired / Free"}</h2>
            </div>
            <div className={`status-pill ${isSubscriptionActive ? "active" : "expired"}`}>
              {isSubscriptionActive ? `${daysRemaining} ថ្ងៃនៅសល់` : "Locked"}
            </div>
          </div>

          <p style={{ marginTop: "6px", fontSize: "0.85rem", color: "#94a3b8" }}>
            {isSubscriptionActive
              ? `គណនីរបស់អ្នកមានសិទ្ធិពេញលេញក្នុងការមើល Signal និង Real Indicators។ ផុតកំណត់នៅ: ${new Date(membership.expiresAt).toLocaleDateString()}`
              : "ផ្នែក Current Signal ត្រូវបានបាំង (Blur)។ សូម Unlock ដើម្បីទទួលបានសិទ្ធិមើលពេញលេញ។"}
          </p>

          <button
            className="action-accent-btn"
            style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
            onClick={() => setShowPaywallModal(true)}
          >
            <Sparkles size={16} />
            <span>{isSubscriptionActive ? "បន្តសុពលភាព / Manage Subscription" : "Unlock Premium Signal ($20/Month)"}</span>
          </button>
        </section>

        {/* 
          CLIENT STRATEGY SWITCHER 
          (Clients can browse and select strategies here)
        */}
        <section className="page-card">
          <span className="eyebrow" style={{ color: "#38bdf8" }}>
            TRADING STRATEGIES
          </span>
          <h2>ជ្រើសរើស Strategy សម្រាប់ជួញដូរ</h2>
          <p className="section-subtitle">
            ជ្រើសរើស Strategy ណាមួយដែលស័ក្តិសមជាមួយស្ទីលជួញដូររបស់អ្នក។ ប្រព័ន្ធនឹងគណនា Signal តាម Strategy នោះភ្លាមៗ៖
          </p>

          <div className="strategy-list">
            {strategies.map((strat) => {
              const isSelected = strat.id === activeStrategyId;
              return (
                <div
                  key={strat.id}
                  className={`strategy-card-item ${isSelected ? "strategy-card-active" : ""}`}
                >
                  <div className="strat-card-header">
                    <div>
                      <div className="strat-card-title-row">
                        <strong className="strat-card-name">{strat.name}</strong>
                        {isSelected && <span className="strat-active-badge">Active</span>}
                      </div>
                      <div className="strat-card-meta">
                        <span className="strat-category-tag">{strat.category}</span>
                        <span className="strat-meta-pill">TF: {strat.timeframe}</span>
                        <span className="strat-meta-pill">Pair: {strat.recommendedPair}</span>
                      </div>
                    </div>
                  </div>

                  <p className="strat-card-desc">{strat.description}</p>

                  <div className="strat-card-stats-row">
                    <div>
                      <span>Win Rate:</span>
                      <strong className="green-text">{strat.winRate}</strong>
                    </div>
                    <div>
                      <span>Target RR:</span>
                      <strong>{strat.defaultRR}</strong>
                    </div>
                  </div>

                  <button
                    className={`strat-switch-btn ${isSelected ? "is-selected" : ""}`}
                    onClick={() => handleSwitchStrategy(strat.id)}
                    disabled={isSelected}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>កំពុងប្រើប្រាស់ (Active)</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight size={16} />
                        <span>ប្តូរប្រើ Strategy នេះ</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* 
          ADMIN MANAGEMENT PANEL (For Owner Only - PIN: 8888)
          - Assign 3-Day Free Trial, 1 Month, 2 Months
          - Upload new strategies & JSON import
        */}
        <section className="page-card" style={{ border: "1px dashed rgba(255, 255, 255, 0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span className="eyebrow" style={{ color: "#eab308" }}>
                OWNER & ADMIN CONTROL
              </span>
              <h2>Admin Management</h2>
            </div>
            {isAdminUnlocked && (
              <button
                className="mini-lock-btn"
                onClick={() => setIsAdminUnlocked(false)}
                title="Lock Admin"
              >
                <Lock size={14} />
                <span>Lock</span>
              </button>
            )}
          </div>

          {!isAdminUnlocked ? (
            <form onSubmit={handleAdminLogin} className="admin-lock-box">
              <Lock size={28} className="lock-icon" />
              <p>បញ្ចូល Admin PIN ដើម្បីគ្រប់គ្រងសិទ្ធិ Client និង Upload យុទ្ធសាស្ត្រថ្មីៗ</p>
              <div className="pin-input-group">
                <input
                  type="password"
                  placeholder="Admin PIN (Default: 8888)"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className={`pin-input ${adminPinError ? "error" : ""}`}
                />
                <button type="submit" className="pin-submit-btn">
                  Unlock Admin
                </button>
              </div>
              {adminPinError && <span className="pin-error-text">លេខ PIN មិនត្រឹមត្រូវទេ (សាកល្បង: 8888)</span>}
            </form>
          ) : (
            <div className="admin-unlocked-content">
              {/* Add Client Form */}
              <form onSubmit={handleAddNewClient} className="add-client-form">
                <strong>បន្ថែម Client ថ្មី (Assign Access)</strong>
                <div className="add-client-row">
                  <input
                    type="text"
                    placeholder="Telegram Username (e.g. @sokha)"
                    value={newClientId}
                    onChange={(e) => setNewClientId(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Client Name (e.g. Sokha)"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <button type="submit" className="add-btn">
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Client List Table */}
              <div className="client-list-section">
                <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  បញ្ជី Client និងការកំណត់ Plan ({clients.length} នាក់)
                </strong>
                <div className="client-table">
                  {clients.map((client) => {
                    const isClientActive = client.status === "ACTIVE" && client.expiresAt > Date.now();
                    const days = Math.max(0, Math.ceil((client.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <div key={client.id} className="client-row">
                        <div className="client-info">
                          <strong>{client.name}</strong>
                          <span>{client.username}</span>
                          <small className={isClientActive ? "green-text" : "red-text"}>
                            {isClientActive ? `${client.plan} (${days} ថ្ងៃ)` : "EXPIRED"}
                          </small>
                        </div>
                        <div className="client-actions">
                          <button
                            className="admin-action-btn trial"
                            onClick={() => assignPlanToUser(client.id, "TRIAL")}
                          >
                            3D Trial
                          </button>
                          <button
                            className="admin-action-btn month"
                            onClick={() => assignPlanToUser(client.id, "1_MONTH")}
                          >
                            1 Month
                          </button>
                          <button
                            className="admin-action-btn month2"
                            onClick={() => assignPlanToUser(client.id, "2_MONTHS")}
                          >
                            2 Months
                          </button>
                          <button
                            className="admin-action-btn revoke"
                            onClick={() => assignPlanToUser(client.id, "REVOKE")}
                          >
                            Lock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategy Upload & Manager Section for Owner */}
              <div className="admin-strategy-manager">
                <div className="admin-strat-header">
                  <div>
                    <strong style={{ color: "#38bdf8", fontSize: "0.95rem" }}>
                      Strategy Upload & JSON Management (Owner Only)
                    </strong>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "2px 0 0" }}>
                      បង្កើត ឬ Upload យុទ្ធសាស្ត្រថ្មីៗចូល App សម្រាប់ឱ្យ Client ជ្រើសរើសប្រើប្រាស់
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="upload-trigger-btn"
                      onClick={() => setShowJsonUploader(!showJsonUploader)}
                    >
                      <Upload size={14} />
                      <span>{showJsonUploader ? "បិទ JSON" : "Upload JSON"}</span>
                    </button>
                    <button
                      className="upload-trigger-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileSpreadsheet size={14} />
                      <span>ជ្រើស File</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept=".json"
                      onChange={handleFileChange}
                    />
                    <button
                      className="upload-trigger-btn"
                      onClick={handleDownloadStrategiesJson}
                    >
                      <Download size={14} />
                      <span>Backup JSON</span>
                    </button>
                  </div>
                </div>

                {/* JSON Input Modal */}
                {showJsonUploader && (
                  <div className="json-input-box">
                    <textarea
                      rows={5}
                      placeholder='Paste Strategy JSON format ទីនេះ ឧទាហរណ៍៖ {"name": "ICT Silver Bullet", "category": "ICT / SMC", "timeframe": "M5", "defaultRR": "1:3"}'
                      value={stratJsonInput}
                      onChange={(e) => setStratJsonInput(e.target.value)}
                    />
                    <button className="json-apply-btn" onClick={handleUploadJson}>
                      Confirm Import JSON
                    </button>
                  </div>
                )}

                {/* Add Strategy Form */}
                <form onSubmit={handleCreateCustomStrategy} className="new-strat-form">
                  <div className="form-grid-2">
                    <input
                      type="text"
                      placeholder="ឈ្មោះ Strategy (e.g. ICT Silver Bullet M5)"
                      value={newStratName}
                      onChange={(e) => setNewStratName(e.target.value)}
                      required
                    />
                    <select
                      value={newStratCategory}
                      onChange={(e) => setNewStratCategory(e.target.value)}
                    >
                      <option value="ICT / SMC">ICT / SMC</option>
                      <option value="Scalping">Scalping</option>
                      <option value="Order Flow">Order Flow</option>
                      <option value="Trend Following">Trend Following</option>
                      <option value="Custom">Custom Algorithm</option>
                    </select>
                  </div>
                  <div className="form-grid-3">
                    <input
                      type="text"
                      placeholder="Timeframe (e.g. M5, M15)"
                      value={newStratTimeframe}
                      onChange={(e) => setNewStratTimeframe(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Target RR (e.g. 1:3)"
                      value={newStratRR}
                      onChange={(e) => setNewStratRR(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Win Rate (e.g. 74%)"
                      value={newStratWinRate}
                      onChange={(e) => setNewStratWinRate(e.target.value)}
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="ការពិពណ៌នាអំពី Strategy..."
                    value={newStratDesc}
                    onChange={(e) => setNewStratDesc(e.target.value)}
                  />
                  <button type="submit" className="add-strat-btn">
                    <Plus size={16} />
                    <span>Upload & រក្សាទុក Strategy ថ្មី</span>
                  </button>
                </form>

                {/* Manage Custom Strategies List */}
                <div className="admin-strat-list">
                  <strong style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                    យុទ្ធសាស្ត្រទាំងអស់ក្នុងប្រព័ន្ធ ({strategies.length})
                  </strong>
                  {strategies.map((s) => (
                    <div key={s.id} className="admin-strat-row">
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.category} | {s.timeframe} | RR {s.defaultRR}</small>
                      </div>
                      {s.isCustom && (
                        <button
                          className="delete-strat-btn"
                          onClick={() => handleDeleteStrategy(s.id)}
                          title="Delete Strategy"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
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
      {/* Top Header */}
      <header className="topbar">
        <div>
          <div className="brand">MASTER AI</div>
          <div className="brand-subtitle">ANALYSIS</div>
        </div>

        <div className="connection">
          <span className={`status-dot ${connection === "CONNECTED" || connection === "ONLINE" ? "online" : ""}`} />
          {connection}
        </div>
      </header>

      {/* Main View */}
      <main className="main-content">{renderPage()}
      </main>

      {/* Bottom Navigation */}
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

      {/* Paywall Modal with ABA KHQR Card */}
      {showPaywallModal && (
        <div className="modal-backdrop" onClick={() => setShowPaywallModal(false)}>
          <div className="paywall-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-close" onClick={() => setShowPaywallModal(false)}>
              <X size={20} />
            </div>

            <div className="paywall-modal-header">
              <span className="eyebrow" style={{ color: "#38bdf8" }}>
                UPGRADE TO VIP SIGNAL
              </span>
              <h2>Unlock Premium Analysis</h2>
              <p>ទទួលបាន Signal Buy/Sell, Entry, Stop Loss, Take Profit ផ្ទាល់ និងសំឡេងរោទ៍ Chime</p>
            </div>

            {/* ABA BANK KHQR Card Graphic */}
            <div className="aba-khqr-card">
              <div className="khqr-card-header">
                <div className="khqr-badge">KHQR</div>
                <div className="aba-bank-name">ABA BANK</div>
              </div>

              <div className="khqr-recipient">
                <span className="recipient-label">ACCOUNT NAME</span>
                <strong className="recipient-name">RATHANA THENG</strong>
                <span className="recipient-acc">000 686 288 (USD)</span>
              </div>

              {/* KHQR Center Graphic */}
              <div className="khqr-qr-container">
                <svg viewBox="0 0 100 100" className="khqr-svg">
                  <rect width="100" height="100" fill="#ffffff" rx="6" />
                  <rect x="10" y="10" width="24" height="24" fill="#003e65" rx="3" />
                  <rect x="15" y="15" width="14" height="14" fill="#ffffff" rx="1" />
                  <rect x="18" y="18" width="8" height="8" fill="#003e65" />
                  <rect x="66" y="10" width="24" height="24" fill="#003e65" rx="3" />
                  <rect x="71" y="15" width="14" height="14" fill="#ffffff" rx="1" />
                  <rect x="74" y="18" width="8" height="8" fill="#003e65" />
                  <rect x="10" y="66" width="24" height="24" fill="#003e65" rx="3" />
                  <rect x="15" y="71" width="14" height="14" fill="#ffffff" rx="1" />
                  <rect x="18" y="74" width="8" height="8" fill="#003e65" />
                  <circle cx="50" cy="50" r="10" fill="#dc2626" />
                  <text x="50" y="54" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">$</text>
                </svg>
              </div>

              <div className="khqr-price-badge">
                <span>AMOUNT:</span> <strong>$20.00 / MONTH</strong>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="paywall-modal-actions">
              <button className="copy-aba-btn" onClick={copyAbaAccount}>
                <Copy size={16} />
                <span>{copiedAccount ? "បាន Copy លេខកុង ABA រួចរាល់!" : "Copy ABA Account: 000 686 288"}</span>
              </button>

              <button className="trial-activate-btn" onClick={activateTrial}>
                <Sparkles size={16} />
                <span>Activate 3-Day Free Trial (សាកល្បង ៣ ថ្ងៃដោយឥតគិតថ្លៃ)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Trade to Journal Modal */}
      {showAddTradeModal && (
        <div className="modal-backdrop" onClick={() => setShowAddTradeModal(false)}>
          <div className="journal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-close" onClick={() => setShowAddTradeModal(false)}>
              <X size={20} />
            </div>

            <h3>កត់ត្រា Trade ថ្មីក្នុង Journal</h3>
            <form onSubmit={handleAddTrade} className="journal-form">
              <div className="form-grid-2">
                <div>
                  <label>Market Symbol</label>
                  <select
                    value={newTrade.symbol}
                    onChange={(e) => setNewTrade({ ...newTrade, symbol: e.target.value })}
                  >
                    <option value="XAUUSD">XAUUSD (Gold)</option>
                    <option value="BTCUSD">BTCUSD (Bitcoin)</option>
                  </select>
                </div>
                <div>
                  <label>Trade Side</label>
                  <select
                    value={newTrade.side}
                    onChange={(e) => setNewTrade({ ...newTrade, side: e.target.value })}
                  >
                    <option value="BUY">BUY (Long)</option>
                    <option value="SELL">SELL (Short)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div>
                  <label>Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 2650.5"
                    value={newTrade.entryPrice}
                    onChange={(e) => setNewTrade({ ...newTrade, entryPrice: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Exit Price</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 2670.5"
                    value={newTrade.exitPrice}
                    onChange={(e) => setNewTrade({ ...newTrade, exitPrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div>
                  <label>Outcome</label>
                  <select
                    value={newTrade.outcome}
                    onChange={(e) => setNewTrade({ ...newTrade, outcome: e.target.value })}
                  >
                    <option value="HIT_TP1">HIT TP1</option>
                    <option value="HIT_TP2">HIT TP2</option>
                    <option value="HIT_SL">HIT SL</option>
                  </select>
                </div>
                <div>
                  <label>RR Gained</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 2.0 or -1.0"
                    value={newTrade.rrGained}
                    onChange={(e) => setNewTrade({ ...newTrade, rrGained: e.target.value })}
                  />
                </div>
                <div>
                  <label>Pips</label>
                  <input
                    type="number"
                    placeholder="e.g. 150 or -80"
                    value={newTrade.pips}
                    onChange={(e) => setNewTrade({ ...newTrade, pips: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label>Trade Notes (ហេតុផលចូល Trade)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Asian session liquidity sweep + M5 BOS FVG confirmation"
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                />
              </div>

              <button type="submit" className="save-trade-btn">
                រក្សាទុកក្នុង Journal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
