import { useState, useEffect, useMemo } from "react";

const CHART_SYMBOLS = [
  { id: "OANDA:XAUUSD", label: "OANDA:XAUUSD (Gold)", icon: "🪙", short: "XAUUSD" },
  { id: "BINANCE:BTCUSDT", label: "BINANCE:BTCUSDT (Bitcoin)", icon: "₿", short: "BTCUSD" },
];

const TIMEFRAMES = [
  { id: "1", label: "M1" },
  { id: "5", label: "M5" }, // Default M5
  { id: "15", label: "M15" },
  { id: "60", label: "H1" },
  { id: "240", label: "H4" },
  { id: "D", label: "D1" },
];

export default function TradingViewChart({ defaultSymbol = "OANDA:XAUUSD", onSelectMarket, livePrice }) {
  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol);
  const [selectedInterval, setSelectedInterval] = useState("5"); // Default M5
  const [chartKey, setChartKey] = useState(0);

  // Sync symbol when defaultSymbol prop changes from outer state
  useEffect(() => {
    if (defaultSymbol && defaultSymbol !== selectedSymbol) {
      setSelectedSymbol(defaultSymbol);
      setChartKey((prev) => prev + 1);
    }
  }, [defaultSymbol]);

  const handleSymbolChange = (sym) => {
    setSelectedSymbol(sym);
    setChartKey((prev) => prev + 1);
    if (onSelectMarket) {
      const match = sym.includes("XAU") ? "XAUUSD" : "BTCUSD";
      onSelectMarket(match);
    }
  };

  const handleIntervalChange = (tf) => {
    setSelectedInterval(tf);
    setChartKey((prev) => prev + 1);
  };

  const embedUrl = useMemo(() => {
    const encodedSym = encodeURIComponent(selectedSymbol);
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodedSym}&interval=${selectedInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${encodedSym}`;
  }, [selectedSymbol, selectedInterval, chartKey]);

  return (
    <div
      className="tradingview-edge-to-edge"
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        padding: 0,
        border: "none",
        boxSizing: "border-box",
      }}
    >
      {/* Top Edge-to-Edge Control Bar: Symbol Switcher & Timeframe Selector */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "10px 12px",
          background: "#0b111e",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Toggle Switcher Buttons for OANDA:XAUUSD vs BINANCE:BTCUSDT */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          {CHART_SYMBOLS.map((item) => {
            const isActive = selectedSymbol === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSymbolChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: isActive ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                  background: isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(18, 25, 42, 0.6)",
                  color: isActive ? "#38bdf8" : "#94a3b8",
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <span
                    style={{
                      fontSize: "0.58rem",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      background: "#22c55e",
                      color: "#000",
                      fontWeight: 800,
                    }}
                  >
                    100% SYNC
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Timeframe & Feed Sync Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                boxShadow: "0 0 6px #22c55e",
              }}
            />
            <span style={{ fontSize: "0.74rem", color: "#38bdf8", fontWeight: 700 }}>
              {selectedSymbol}
            </span>
            {livePrice && (
              <strong style={{ fontSize: "0.82rem", color: "#f8fafc", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                ${Number(livePrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            )}
            <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
              • {selectedSymbol.includes("XAU") ? "OANDA Spot" : "Binance Spot"}
            </span>
          </div>

          {/* Timeframe Buttons */}
          <div style={{ display: "flex", gap: "4px" }}>
            {TIMEFRAMES.map((tf) => {
              const isTfActive = selectedInterval === tf.id;
              return (
                <button
                  key={tf.id}
                  onClick={() => handleIntervalChange(tf.id)}
                  style={{
                    padding: "3px 7px",
                    borderRadius: "5px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: isTfActive ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                    background: isTfActive ? "rgba(56, 189, 248, 0.25)" : "rgba(18, 25, 42, 0.5)",
                    color: isTfActive ? "#38bdf8" : "#94a3b8",
                  }}
                >
                  {tf.label} {tf.id === "5" && !isTfActive && "★"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TradingView Advanced Chart IFrame - Full Edge-to-Edge (Zero margin, zero padding, zero outer borders) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100vh - 145px)",
          minHeight: "560px",
          margin: 0,
          padding: 0,
          border: "none",
          background: "#131722",
        }}
      >
        <iframe
          key={`${selectedSymbol}_${selectedInterval}_${chartKey}`}
          title="TradingView Advanced Live Chart"
          src={embedUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            margin: 0,
            padding: 0,
            display: "block",
          }}
          allowTransparency={true}
          scrolling="no"
          allowFullScreen={true}
        />
      </div>
    </div>
  );
}
