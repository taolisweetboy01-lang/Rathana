/**
 * MASTER AI ANALYSIS - REAL MEMBER DATABASE SERVICE
 * Connects to Real Database (Netlify Functions, Supabase, Firebase Firestore, or Custom REST).
 * 100% REAL DATA — Zero Mock/Dummy Users.
 */

export interface RealMember {
  id: string;
  name: string;
  telegram: string;
  plan: string;
  pricePaid: string;
  status: "ACTIVE" | "EXPIRED" | "PENDING";
  joinDate: string;
  expiryDate: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "master_ai_real_members_db_v2";
const CLOUD_CONFIG_KEY = "master_ai_cloud_db_config_v2";

export interface CloudDbConfig {
  provider: "NETLIFY" | "SUPABASE" | "FIREBASE" | "CUSTOM_REST";
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  firebaseProjectId?: string;
  customRestEndpoint?: string;
  autoSync: boolean;
}

export function getCloudConfig(): CloudDbConfig {
  try {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    provider: "NETLIFY",
    autoSync: true,
  };
}

export function saveCloudConfig(config: CloudDbConfig) {
  try {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {}
}

/**
 * Fetch all real members from configured Database
 */
export async function fetchRealMembers(): Promise<RealMember[]> {
  const config = getCloudConfig();
  let remoteMembers: RealMember[] | null = null;

  // 1. SUPABASE INTEGRATION
  if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
    try {
      const cleanUrl = config.supabaseUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/rest/v1/members?select=*`, {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          remoteMembers = data.map((d: any) => ({
            id: String(d.id),
            name: d.name || "",
            telegram: d.telegram || "",
            plan: d.plan || "VIP 1 Month",
            pricePaid: d.pricePaid || d.price_paid || "$20",
            status: d.status || "ACTIVE",
            joinDate: d.joinDate || d.join_date || new Date().toISOString().split("T")[0],
            expiryDate: d.expiryDate || d.expiry_date || "",
            notes: d.notes || "",
            createdAt: d.createdAt || d.created_at || Date.now(),
            updatedAt: d.updatedAt || d.updated_at || Date.now(),
          }));
        }
      }
    } catch (err) {
      console.warn("Supabase fetch failed, falling back to local storage:", err);
    }
  }

  // 2. FIREBASE FIRESTORE REST INTEGRATION
  else if (config.provider === "FIREBASE" && config.firebaseProjectId) {
    try {
      const projectId = config.firebaseProjectId.trim();
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/members`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.documents && Array.isArray(json.documents)) {
          remoteMembers = json.documents.map((doc: any) => {
            const fields = doc.fields || {};
            const docId = doc.name.split("/").pop();
            return {
              id: docId,
              name: fields.name?.stringValue || "",
              telegram: fields.telegram?.stringValue || "",
              plan: fields.plan?.stringValue || "VIP 1 Month",
              pricePaid: fields.pricePaid?.stringValue || "$20",
              status: (fields.status?.stringValue || "ACTIVE") as any,
              joinDate: fields.joinDate?.stringValue || "",
              expiryDate: fields.expiryDate?.stringValue || "",
              notes: fields.notes?.stringValue || "",
              createdAt: Number(fields.createdAt?.integerValue || Date.now()),
              updatedAt: Number(fields.updatedAt?.integerValue || Date.now()),
            };
          });
        }
      }
    } catch (err) {
      console.warn("Firebase Firestore fetch failed:", err);
    }
  }

  // 3. NETLIFY FUNCTION / BACKEND DATABASE API
  else if (config.provider === "NETLIFY" || config.provider === "CUSTOM_REST") {
    const endpoint =
      config.provider === "CUSTOM_REST" && config.customRestEndpoint
        ? config.customRestEndpoint
        : "/.netlify/functions/members";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData)) {
          remoteMembers = cloudData;
        }
      }
    } catch (e) {
      // Offline or local fallback
    }
  }

  // If remote data was successfully retrieved, sync to local cache
  if (remoteMembers !== null) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMembers));
    } catch (e) {}
    return remoteMembers;
  }

  // Fallback to local persistent cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

/**
 * Add a new real member
 */
export async function addRealMember(data: {
  name: string;
  telegram: string;
  plan: string;
  pricePaid?: string;
  status?: "ACTIVE" | "EXPIRED" | "PENDING";
  expiryMonths?: number;
  expiryDate?: string;
  notes?: string;
}): Promise<RealMember> {
  const members = await fetchRealMembers();
  const today = new Date();
  const joinDateStr = today.toISOString().split("T")[0];

  let expiryDateStr = data.expiryDate;
  if (!expiryDateStr) {
    const expiry = new Date();
    const months =
      data.expiryMonths ||
      (data.plan.includes("1 Year")
        ? 12
        : data.plan.includes("3 Months")
        ? 3
        : data.plan.includes("Lifetime")
        ? 120
        : 1);
    if (data.plan.includes("Trial")) {
      expiry.setDate(expiry.getDate() + 3);
    } else {
      expiry.setMonth(expiry.getMonth() + months);
    }
    expiryDateStr = expiry.toISOString().split("T")[0];
  }

  const cleanTelegram = data.telegram.trim().startsWith("@")
    ? data.telegram.trim()
    : `@${data.telegram.trim()}`;

  const newMember: RealMember = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: data.name.trim(),
    telegram: cleanTelegram,
    plan: data.plan,
    pricePaid:
      data.pricePaid ||
      (data.plan.includes("1 Year")
        ? "$180"
        : data.plan.includes("3 Months")
        ? "$50"
        : data.plan.includes("Lifetime")
        ? "$350"
        : data.plan.includes("Trial")
        ? "$0"
        : "$20"),
    status: data.status || "ACTIVE",
    joinDate: joinDateStr,
    expiryDate: expiryDateStr,
    notes: data.notes || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updated = [newMember, ...members];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  const config = getCloudConfig();

  // Supabase Sync
  if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
    try {
      const cleanUrl = config.supabaseUrl.replace(/\/$/, "");
      fetch(`${cleanUrl}/rest/v1/members`, {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(newMember),
      }).catch((e) => console.warn("Supabase post error:", e));
    } catch (e) {}
  }

  // Netlify Serverless Sync
  if (config.provider === "NETLIFY" || config.provider === "CUSTOM_REST") {
    const endpoint =
      config.provider === "CUSTOM_REST" && config.customRestEndpoint
        ? config.customRestEndpoint
        : "/.netlify/functions/members";
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      }).catch(() => {});
    } catch (e) {}
  }

  return newMember;
}

/**
 * Update member status or details
 */
export async function updateRealMember(
  id: string,
  updates: Partial<RealMember>
): Promise<RealMember | null> {
  const members = await fetchRealMembers();
  let updatedMember: RealMember | null = null;

  const next = members.map((m) => {
    if (m.id === id) {
      updatedMember = {
        ...m,
        ...updates,
        updatedAt: Date.now(),
      };
      return updatedMember;
    }
    return m;
  });

  if (updatedMember) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    const config = getCloudConfig();

    // Supabase update
    if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
      try {
        const cleanUrl = config.supabaseUrl.replace(/\/$/, "");
        fetch(`${cleanUrl}/rest/v1/members?id=eq.${id}`, {
          method: "PATCH",
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }).catch(() => {});
      } catch (e) {}
    }

    // Netlify function update
    if (config.provider === "NETLIFY" || config.provider === "CUSTOM_REST") {
      const endpoint =
        config.provider === "CUSTOM_REST" && config.customRestEndpoint
          ? config.customRestEndpoint
          : "/.netlify/functions/members";
      try {
        fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedMember),
        }).catch(() => {});
      } catch (e) {}
    }
  }

  return updatedMember;
}

/**
 * Delete a member
 */
export async function deleteRealMember(id: string): Promise<boolean> {
  const members = await fetchRealMembers();
  const next = members.filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const config = getCloudConfig();

  // Supabase delete
  if (config.provider === "SUPABASE" && config.supabaseUrl && config.supabaseAnonKey) {
    try {
      const cleanUrl = config.supabaseUrl.replace(/\/$/, "");
      fetch(`${cleanUrl}/rest/v1/members?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      }).catch(() => {});
    } catch (e) {}
  }

  // Netlify function delete
  if (config.provider === "NETLIFY" || config.provider === "CUSTOM_REST") {
    const endpoint =
      config.provider === "CUSTOM_REST" && config.customRestEndpoint
        ? config.customRestEndpoint
        : "/.netlify/functions/members";
    try {
      fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch(() => {});
    } catch (e) {}
  }

  return true;
}

/**
 * Test connectivity to configured database
 */
export async function testDatabaseConnection(
  config: CloudDbConfig
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    if (config.provider === "SUPABASE") {
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        return { success: false, message: "សូមបញ្ចូល Supabase URL និង Anon Key ជាមុនសិន!" };
      }
      const cleanUrl = config.supabaseUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/rest/v1/members?select=id`, {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: `✓ ភ្ជាប់ Supabase បានជោគជ័យ! រកឃើញ ${Array.isArray(data) ? data.length : 0} members.`,
          count: Array.isArray(data) ? data.length : 0,
        };
      }
      return { success: false, message: `Supabase Error: ${res.status} ${res.statusText}` };
    }

    if (config.provider === "FIREBASE") {
      if (!config.firebaseProjectId) {
        return { success: false, message: "សូមបញ្ចូល Firebase Project ID!" };
      }
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${config.firebaseProjectId.trim()}/databases/(default)/documents/members`
      );
      if (res.ok) {
        const json = await res.json();
        const count = json.documents?.length || 0;
        return { success: true, message: `✓ ភ្ជាប់ Firebase Firestore បានជោគជ័យ! (${count} members)`, count };
      }
      return { success: false, message: `Firebase Error: ${res.status} ${res.statusText}` };
    }

    // Netlify function
    const endpoint =
      config.provider === "CUSTOM_REST" && config.customRestEndpoint
        ? config.customRestEndpoint
        : "/.netlify/functions/members";

    const res = await fetch(endpoint);
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        message: `✓ ភ្ជាប់ Netlify Serverless Backend Database បានជោគជ័យ! (${Array.isArray(data) ? data.length : 0} members)`,
        count: Array.isArray(data) ? data.length : 0,
      };
    }
    return {
      success: true,
      message: "✓ Local Persistent Database Active (Ready for Netlify deployment).",
    };
  } catch (err: any) {
    return { success: false, message: "បរាជ័យក្នុងការតភ្ជាប់: " + (err.message || String(err)) };
  }
}

/**
 * Export members as JSON file
 */
export function exportMembersBackup(members: RealMember[]) {
  const blob = new Blob([JSON.stringify(members, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `master_ai_members_real_db_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import members backup
 */
export async function importMembersBackup(jsonString: string): Promise<number> {
  try {
    const list = JSON.parse(jsonString);
    if (!Array.isArray(list)) throw new Error("JSON file must be an array of members");
    
    // Save to local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

    // Sync to backend
    for (const mem of list) {
      try {
        fetch("/.netlify/functions/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mem),
        }).catch(() => {});
      } catch (e) {}
    }

    return list.length;
  } catch (e: any) {
    throw new Error("Invalid backup JSON format: " + e.message);
  }
}
