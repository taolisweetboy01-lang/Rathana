export default function ConfidenceBreakdownModal({ isOpen, onClose, score = 98, signal }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 150,
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#0f172a",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "16px",
          padding: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.9)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.2rem" }}>🎯</span>
              <strong style={{ fontSize: "1.05rem", color: "#f8fafc" }}>
                Confidence Score {score}/100 មានន័យដូចម្តេច?
              </strong>
            </div>
            <span style={{ fontSize: "0.72rem", color: "#38bdf8" }}>
              High-Confluence Quantitative Rating (A+ Institutional Grade)
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "none",
              color: "#94a3b8",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Score Hero Banner */}
        <div
          style={{
            padding: "14px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "block" }}>
              CONFLUENCE RATING
            </span>
            <strong style={{ fontSize: "1.8rem", color: "#22c55e", lineHeight: 1 }}>
              {score} <span style={{ fontSize: "1rem", color: "#94a3b8" }}>/ 100</span>
            </strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: "6px",
                background: "#22c55e",
                color: "#000",
                display: "inline-block",
              }}
            >
              GRADE A+ SETUP
            </span>
            <small style={{ display: "block", color: "#94a3b8", fontSize: "0.68rem", marginTop: "3px" }}>
              Highest Probability
            </small>
          </div>
        </div>

        {/* 5 Confluence Pillars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
          {/* Pillar 1 */}
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#38bdf8" }}>1. M15 Trend Direction</strong>
              <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 700 }}>25 / 25 pts</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "#94a3b8", lineHeight: "1.4" }}>
              និន្នាការធំ M15 ច្បាស់លាស់ 100% (បង្កើត Higher Highs / Lows សម្រាប់ Buy) មិនស្ថិតក្នុង Sideway ឡើយ។
            </p>
          </div>

          {/* Pillar 2 */}
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#38bdf8" }}>2. M5 Setup Quality & Retest</strong>
              <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 700 }}>25 / 25 pts</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "#94a3b8", lineHeight: "1.4" }}>
              មាន Pullback Retest ត្រឹមត្រូវប៉ះ EMA 20/50 Key Support ឬ Liquidity Sweep មុននឹងបន្តដំណើរ។
            </p>
          </div>

          {/* Pillar 3 */}
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#38bdf8" }}>3. M3 Momentum Displacement Entry</strong>
              <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 700 }}>18 / 20 pts</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "#94a3b8", lineHeight: "1.4" }}>
              ទៀន Trigger M3 បញ្ជាក់កម្លាំង Momentum ខ្លាំង ដោយបង្កើត Displacement Candle បំបែក Micro-Structure។
            </p>
          </div>

          {/* Pillar 4 */}
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#38bdf8" }}>4. Support/Resistance Obstacle Clearance</strong>
              <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 700 }}>15 / 15 pts</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "#94a3b8", lineHeight: "1.4" }}>
              ផ្លូវរត់ពី Entry ទៅ TP1 និង TP2 គ្មានរបាំង Resistance ឬ Support ធំមករារាំងឡើយ (Clear Path)។
            </p>
          </div>

          {/* Pillar 5 */}
          <div style={{ padding: "10px 12px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#38bdf8" }}>5. Risk-to-Reward Ratio (1:2+)</strong>
              <span style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 700 }}>15 / 15 pts</span>
            </div>
            <p style={{ margin: 0, fontSize: "0.74rem", color: "#94a3b8", lineHeight: "1.4" }}>
              ផលធៀបចំណេញធៀបខាតល្អបំផុត (Stop Loss ផ្អែកលើ Swing Low ពិតប្រាកដ និង TP1 = 1R, TP2 = 2R)។
            </p>
          </div>
        </div>

        {/* Signal Lock Notice */}
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "10px",
            fontSize: "0.74rem",
            color: "#6ee7b7",
            lineHeight: "1.5",
          }}
        >
          🔒 <strong>គោលការណ៍ Non-Repainting:</strong> នៅពេល Signal បានបញ្ជាក់ចេញមកហើយ
          ប្រព័ន្ធនឹងមិនដក Signal វិញឡើយ! Signal នឹងបន្តរត់រហូតដល់ប៉ះ TP1, TP2 ឬ Stop Loss (SL) ជាក់ស្តែង។
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "14px",
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            background: "#38bdf8",
            border: "none",
            color: "#000",
            fontWeight: 800,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          យល់ច្បាស់ហើយ (Close)
        </button>
      </div>
    </div>
  );
}
