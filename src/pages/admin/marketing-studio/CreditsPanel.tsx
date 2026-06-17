import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ExternalLink } from "lucide-react";

type ServiceStatus = {
  configured: boolean;
  status?: "healthy" | "out_of_credits" | "rate_limited" | "error" | "missing";
  message?: string;
  username?: string | null;
  name?: string | null;
};

type StatusResp = {
  lovable: ServiceStatus;
  replicate: ServiceStatus;
  checkedAt: string;
};

const dot = (status?: string) => {
  if (status === "healthy") return "#22c55e";
  if (status === "rate_limited") return "#f59e0b";
  if (status === "out_of_credits") return "#ef4444";
  if (status === "missing") return "#666";
  return "#ef4444";
};

const label = (status?: string) => {
  if (status === "healthy") return "Healthy";
  if (status === "rate_limited") return "Rate limited";
  if (status === "out_of_credits") return "Out of credits";
  if (status === "missing") return "Not configured";
  return "Error";
};

export default function CreditsPanel() {
  const [data, setData] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-credits-status");
      if (error) throw error;
      setData(data as StatusResp);
    } catch (e: any) {
      setError(e?.message || "Failed to check status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const card = (
    title: string,
    svc: ServiceStatus | undefined,
    billingUrl: string,
    billingLabel: string,
    note?: string,
  ) => (
    <div
      style={{
        background: "#111",
        border: "0.5px solid #1c1c1c",
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e8e8e8" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dot(svc?.status),
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 11, color: "#aaa" }}>{label(svc?.status)}</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#777", minHeight: 16 }}>
        {svc?.message || (loading ? "Checking…" : "—")}
      </div>
      {note && <div style={{ fontSize: 10, color: "#555", lineHeight: 1.4 }}>{note}</div>}
      <a
        href={billingUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "#aaa",
          border: "0.5px solid #1c1c1c",
          borderRadius: 6,
          padding: "6px 10px",
          width: "fit-content",
          textDecoration: "none",
        }}
      >
        {billingLabel}
        <ExternalLink size={11} />
      </a>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "#3a3a3a",
            textTransform: "uppercase",
          }}
        >
          Credits & Status
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            color: "#aaa",
            border: "0.5px solid #1c1c1c",
            borderRadius: 5,
            padding: "4px 8px",
            background: "transparent",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "#ef4444" }}>{error}</div>
      )}

      {card(
        "Lovable AI",
        data?.lovable,
        "https://lovable.dev/settings/workspace/billing",
        "Manage Lovable billing",
        "Live credit balance isn't exposed by the API — check the workspace billing page.",
      )}

      {card(
        "Replicate",
        data?.replicate,
        "https://replicate.com/account/billing",
        "Manage Replicate billing",
        data?.replicate?.username
          ? `Account: ${data.replicate.username}. Replicate doesn't expose a balance via API — check billing.`
          : "Replicate doesn't expose a balance via API — check billing.",
      )}

      {data?.checkedAt && (
        <div style={{ fontSize: 10, color: "#444", textAlign: "right" }}>
          Checked {new Date(data.checkedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
