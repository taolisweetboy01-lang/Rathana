import { useState, useEffect, useMemo, useRef } from "react";
import {
  fetchRealMembers,
  addRealMember,
  updateRealMember,
  deleteRealMember,
  exportMembersBackup,
  importMembersBackup,
  getCloudConfig,
  saveCloudConfig,
  testDatabaseConnection,
} from "../services/memberDatabase";

export default function AdminMemberManager() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [connTestResult, setConnTestResult] = useState(null);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const fileInputRef = useRef(null);

  // Cloud Database Configuration
  const [cloudConfig, setCloudConfig] = useState(getCloudConfig);

  // Form state for adding a real member
  const getInitialExpiry = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    name: "",
    telegram: "",
    plan: "VIP 1 Month",
    pricePaid: "$20",
    status: "ACTIVE",
    expiryDate: getInitialExpiry(),
    notes: "",
  });

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await fetchRealMembers();
      setMembers(data);
    } catch (e) {
      console.warn("Failed to load real members from database:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.telegram.toLowerCase().includes(q) ||
        m.plan.toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || m.status === filterStatus;
      return matchQuery && matchStatus;
    });
  }, [members, searchQuery, filterStatus]);

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.status === "ACTIVE").length;
    const expired = members.filter((m) => m.status === "EXPIRED").length;
    return { total, active, expired };
  }, [members]);

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "ACTIVE" ? "EXPIRED" : "ACTIVE";
    const updated = await updateRealMember(id, { status: nextStatus });
    if (updated) {
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  };

  const handleExtendMonth = async (id, currentExpiry) => {
    const baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 1);
    const newExpiry = baseDate.toISOString().split("T")[0];
    const updated = await updateRealMember(id, { expiryDate: newExpiry, status: "ACTIVE" });
    if (updated) {
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  };

  const handleDeleteMember = async (id, name) => {
    if (window.confirm(`តើអ្នកពិតជាចង់លុប Member "${name}" ពី Database មែនទេ?`)) {
      const ok = await deleteRealMember(id);
      if (ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id));
      }
    }
  };

  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.telegram.trim()) {
      alert("សូមបញ្ចូលឈ្មោះ និង Telegram Username/ID!");
      return;
    }

    try {
      const created = await addRealMember(formData);
      setMembers((prev) => [created, ...prev]);
      setShowAddModal(false);
      setFormData({
        name: "",
        telegram: "",
        plan: "VIP 1 Month",
        pricePaid: "$20",
        status: "ACTIVE",
        expiryDate: getInitialExpiry(),
        notes: "",
      });
    } catch (e) {
      alert("បរាជ័យក្នុងការរក្សាទុក Member: " + e.message);
    }
  };

  const handleSaveCloudConfig = (e) => {
    e.preventDefault();
    saveCloudConfig(cloudConfig);
    setShowCloudModal(false);
    loadMembers();
    alert("✓ ការកំណត់ Database ត្រូវបានរក្សាទុករួចរាល់!");
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setConnTestResult(null);
    try {
      const res = await testDatabaseConnection(cloudConfig);
      setConnTestResult(res);
    } catch (e) {
      setConnTestResult({ success: false, message: e.message });
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importMembersBackup(text);
      await loadMembers();
      alert(`✓ បាន Import Member ចំនួន ${count} នាក់ចូល Database ជោគជ័យ!`);
    } catch (err) {
      alert("Import បរាជ័យ: " + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Hidden file input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json"
        style={{ display: "none" }}
      />

      {/* Admin Panel Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 14px",
          background: "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)",
          border: "1px solid rgba(234, 179, 8, 0.35)",
          borderRadius: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1rem" }}>👑</span>
            <strong style={{ color: "#fbbf24", fontSize: "0.95rem" }}>
              Admin Panel: Member Management
            </strong>
          </div>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
            Real Database (Zero Mock Data) • Provider:{" "}
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>{cloudConfig.provider}</span>
          </span>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => {
              setConnTestResult(null);
              setShowCloudModal(true);
            }}
            title="Database Integration (Netlify / Supabase / Firebase)"
            style={{
              padding: "7px 10px",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#38bdf8",
              fontSize: "0.74rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ☁️ DB Config
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "#fbbf24",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              padding: "7px 12px",
              fontSize: "0.78rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 0 10px rgba(251, 191, 36, 0.3)",
            }}
          >
            <span>+</span>
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            background: "rgba(18, 25, 42, 0.7)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            padding: "10px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "#64748b", display: "block" }}>TOTAL MEMBERS</span>
          <strong style={{ fontSize: "1.25rem", color: "#f8fafc" }}>{stats.total}</strong>
        </div>

        <div
          style={{
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            padding: "10px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "#22c55e", display: "block" }}>ACTIVE VIP</span>
          <strong style={{ fontSize: "1.25rem", color: "#22c55e" }}>{stats.active}</strong>
        </div>

        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "10px",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "#ef4444", display: "block" }}>EXPIRED</span>
          <strong style={{ fontSize: "1.25rem", color: "#ef4444" }}>{stats.expired}</strong>
        </div>
      </div>

      {/* Search Bar & Filter Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="🔍 ស្វែងរកតាមឈ្មោះ, @telegram, ឬ Plan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 14px",
            borderRadius: "9px",
            background: "rgba(18, 25, 42, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#f8fafc",
            fontSize: "0.82rem",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {["ALL", "ACTIVE", "EXPIRED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: filterStatus === status ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                  background: filterStatus === status ? "rgba(56, 189, 248, 0.2)" : "rgba(18, 25, 42, 0.6)",
                  color: filterStatus === status ? "#38bdf8" : "#94a3b8",
                }}
              >
                {status === "ALL"
                  ? `All (${stats.total})`
                  : status === "ACTIVE"
                  ? `Active (${stats.active})`
                  : `Expired (${stats.expired})`}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import Members JSON"
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#38bdf8",
                fontSize: "0.7rem",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              📥 Import
            </button>

            <button
              onClick={() => exportMembersBackup(members)}
              title="Export Members Backup JSON"
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#94a3b8",
                fontSize: "0.7rem",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              💾 Backup
            </button>
          </div>
        </div>
      </div>

      {/* Real Members List Cards (Zero Mock Data) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: "0.82rem" }}>
            កំពុងទាញទិន្នន័យពី Real Database...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "24px",
              background: "rgba(18, 25, 42, 0.5)",
              borderRadius: "10px",
              border: "1px dashed rgba(255, 255, 255, 0.1)",
            }}
          >
            <span style={{ fontSize: "1.6rem", display: "block", marginBottom: "6px" }}>📭</span>
            <strong style={{ color: "#f8fafc", fontSize: "0.9rem", display: "block" }}>
              {members.length === 0
                ? "មិនទាន់មាន Member ក្នុង Database នៅឡើយទេ (Zero Mock Data)"
                : "រកមិនឃើញ Member តាមពាក្យស្វែងរកនេះទេ"}
            </strong>
            <p style={{ color: "#94a3b8", fontSize: "0.76rem", margin: "4px 0 14px 0", lineHeight: "1.4" }}>
              {members.length === 0
                ? "ប្រព័ន្ធដំណើរការលើទិន្នន័យពិត 100%។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីបញ្ចូលសមាជិកដំបូង ឬភ្ជាប់ Supabase/Firebase!"
                : "សូមសាកល្បងស្វែងរកដោយឈ្មោះ ឬ Telegram ផ្សេងទៀត។"}
            </p>
            {members.length === 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: "8px 16px",
                    background: "#fbbf24",
                    color: "#000",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                  }}
                >
                  + Add First Member
                </button>
                <button
                  onClick={() => setShowCloudModal(true)}
                  style={{
                    padding: "8px 14px",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                  }}
                >
                  ☁️ Setup Supabase / Firebase
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredMembers.map((member) => {
            const isActive = member.status === "ACTIVE";
            const daysLeft = getDaysRemaining(member.expiryDate);
            const isNearExpiry = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
            const isPastExpiry = daysLeft !== null && daysLeft < 0;

            const cleanHandle = member.telegram?.replace(/^@/, "");

            return (
              <div
                key={member.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(18, 25, 42, 0.65)",
                  border: isActive
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(239, 68, 68, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {/* Member Title & Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: "0.9rem", color: "#f8fafc" }}>
                      {member.name}
                    </strong>
                    {cleanHandle && (
                      <a
                        href={`https://t.me/${cleanHandle}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "0.76rem",
                          color: "#38bdf8",
                          marginLeft: "8px",
                          textDecoration: "none",
                          fontWeight: 700,
                        }}
                      >
                        @{cleanHandle} ↗
                      </a>
                    )}
                  </div>

                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: isActive ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: isActive ? "#22c55e" : "#ef4444",
                      border: isActive
                        ? "1px solid rgba(34, 197, 94, 0.4)"
                        : "1px solid rgba(239, 68, 68, 0.4)",
                    }}
                  >
                    {isActive ? "ACTIVE" : "EXPIRED"}
                  </span>
                </div>

                {/* Plan & Expiry Details */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                  }}
                >
                  <span>
                    Plan: <strong style={{ color: "#fbbf24" }}>{member.plan}</strong> ({member.pricePaid})
                  </span>
                  <span>
                    Expires:{" "}
                    <strong
                      style={{
                        color: isPastExpiry ? "#ef4444" : isNearExpiry ? "#eab308" : "#f8fafc",
                      }}
                    >
                      {member.expiryDate || "No Expiry"}
                    </strong>
                    {daysLeft !== null && (
                      <span style={{ fontSize: "0.68rem", marginLeft: "4px", color: isPastExpiry ? "#ef4444" : "#64748b" }}>
                        ({isPastExpiry ? "Expired" : `${daysLeft}d left`})
                      </span>
                    )}
                  </span>
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "6px",
                    marginTop: "4px",
                    paddingTop: "6px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <button
                    onClick={() => handleExtendMonth(member.id, member.expiryDate)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: "5px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      background: "rgba(56, 189, 248, 0.1)",
                      color: "#38bdf8",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    +30 ថ្ងៃ (Extend)
                  </button>

                  <button
                    onClick={() => handleToggleStatus(member.id, member.status)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: "5px",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "rgba(255, 255, 255, 0.05)",
                      color: isActive ? "#fca5a5" : "#86efac",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {isActive ? "Set Expired" : "Re-Activate"}
                  </button>

                  <button
                    onClick={() => handleDeleteMember(member.id, member.name)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "5px",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Real Member Modal */}
      {showAddModal && (
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
            zIndex: 100,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "400px",
              background: "#0f172a",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "14px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <strong style={{ fontSize: "1rem", color: "#fbbf24" }}>
                + បន្ថែម Real Member ថ្មីចូល Database
              </strong>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleAddMemberSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div>
                <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                  ឈ្មោះ Member:
                </label>
                <input
                  type="text"
                  required
                  placeholder="ឧ. Sokha Trader"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(18, 25, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                  Telegram Username ឬ ID:
                </label>
                <input
                  type="text"
                  required
                  placeholder="@telegram_username"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "rgba(18, 25, 42, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                    Plan VIP:
                  </label>
                  <select
                    value={formData.plan}
                    onChange={(e) => {
                      const plan = e.target.value;
                      let price = "$20";
                      const exp = new Date();
                      if (plan.includes("3 Months")) {
                        price = "$50";
                        exp.setMonth(exp.getMonth() + 3);
                      } else if (plan.includes("1 Year")) {
                        price = "$180";
                        exp.setFullYear(exp.getFullYear() + 1);
                      } else if (plan.includes("Lifetime")) {
                        price = "$350";
                        exp.setFullYear(exp.getFullYear() + 10);
                      } else if (plan.includes("Trial")) {
                        price = "$0";
                        exp.setDate(exp.getDate() + 3);
                      } else {
                        exp.setMonth(exp.getMonth() + 1);
                      }
                      setFormData({
                        ...formData,
                        plan,
                        pricePaid: price,
                        expiryDate: exp.toISOString().split("T")[0],
                      });
                    }}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "#1e293b",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#f8fafc",
                      fontSize: "0.82rem",
                    }}
                  >
                    <option value="VIP 1 Month">VIP 1 Month ($20)</option>
                    <option value="VIP 3 Months">VIP 3 Months ($50)</option>
                    <option value="VIP 1 Year">VIP 1 Year ($180)</option>
                    <option value="VIP Lifetime">VIP Lifetime ($350)</option>
                    <option value="Free Trial (3 Days)">Free Trial (3 Days)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                    តម្លៃទទួលបាន ($):
                  </label>
                  <input
                    type="text"
                    value={formData.pricePaid}
                    onChange={(e) => setFormData({ ...formData, pricePaid: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(18, 25, 42, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#f8fafc",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                  ថ្ងៃផុតកំណត់ (Expiration Date):
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#1e293b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                  Status:
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#1e293b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                >
                  <option value="ACTIVE">ACTIVE (សកម្ម)</option>
                  <option value="EXPIRED">EXPIRED (ផុតកំណត់)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#94a3b8",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: "8px",
                    background: "#fbbf24",
                    border: "none",
                    color: "#000",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Save to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cloud DB Connection Modal (Supabase, Firebase, Netlify API) */}
      {showCloudModal && (
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
            zIndex: 100,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "430px",
              background: "#0f172a",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "14px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "1.1rem" }}>☁️</span>
                <strong style={{ fontSize: "1rem", color: "#38bdf8" }}>
                  Real Database Integration
                </strong>
              </div>
              <button
                onClick={() => setShowCloudModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCloudConfig} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                  Database Engine / Backend:
                </label>
                <select
                  value={cloudConfig.provider}
                  onChange={(e) => {
                    setCloudConfig({ ...cloudConfig, provider: e.target.value });
                    setConnTestResult(null);
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#1e293b",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                  }}
                >
                  <option value="NETLIFY">Netlify Serverless Backend API (Active Default)</option>
                  <option value="SUPABASE">Supabase Cloud Database (PostgreSQL REST)</option>
                  <option value="FIREBASE">Firebase Firestore Database</option>
                  <option value="CUSTOM_REST">Custom Backend REST API</option>
                </select>
              </div>

              {/* SUPABASE CONFIG */}
              {cloudConfig.provider === "SUPABASE" && (
                <>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                      Supabase Project URL:
                    </label>
                    <input
                      type="text"
                      placeholder="https://xxxx.supabase.co"
                      value={cloudConfig.supabaseUrl || ""}
                      onChange={(e) => setCloudConfig({ ...cloudConfig, supabaseUrl: e.target.value })}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "rgba(18, 25, 42, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#f8fafc",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                      Supabase Anon Key:
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
                      value={cloudConfig.supabaseAnonKey || ""}
                      onChange={(e) => setCloudConfig({ ...cloudConfig, supabaseAnonKey: e.target.value })}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "rgba(18, 25, 42, 0.9)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        color: "#f8fafc",
                        fontSize: "0.82rem",
                      }}
                    />
                  </div>
                </>
              )}

              {/* FIREBASE CONFIG */}
              {cloudConfig.provider === "FIREBASE" && (
                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                    Firebase Project ID:
                  </label>
                  <input
                    type="text"
                    placeholder="my-trading-app-12345"
                    value={cloudConfig.firebaseProjectId || ""}
                    onChange={(e) => setCloudConfig({ ...cloudConfig, firebaseProjectId: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(18, 25, 42, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#f8fafc",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>
              )}

              {/* CUSTOM REST CONFIG */}
              {cloudConfig.provider === "CUSTOM_REST" && (
                <div>
                  <label style={{ fontSize: "0.74rem", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                    REST API Endpoint:
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.yourdomain.com/members"
                    value={cloudConfig.customRestEndpoint || ""}
                    onChange={(e) => setCloudConfig({ ...cloudConfig, customRestEndpoint: e.target.value })}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "rgba(18, 25, 42, 0.9)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#f8fafc",
                      fontSize: "0.82rem",
                    }}
                  />
                </div>
              )}

              {/* Test Connection Button & Result */}
              <div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn}
                  style={{
                    width: "100%",
                    padding: "7px 12px",
                    borderRadius: "6px",
                    background: "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isTestingConn ? "កំពុងតេស្ត Connection..." : "🔌 Test Database Connection"}
                </button>

                {connTestResult && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      background: connTestResult.success ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: connTestResult.success ? "#4ade80" : "#f87171",
                      border: `1px solid ${connTestResult.success ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    }}
                  >
                    {connTestResult.message}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  fontSize: "0.72rem",
                  color: "#86efac",
                  lineHeight: "1.4",
                }}
              >
                ✓ រាល់ទិន្នន័យ Member ទាំងអស់នឹងត្រូវ sync ជាមួយ Database ពិតប្រាកដ និងមាន Persistent Backup ស្វ័យប្រវត្តិតែម្តង។
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setShowCloudModal(false)}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#94a3b8",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: "8px",
                    background: "#38bdf8",
                    border: "none",
                    color: "#000",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  Save & Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
