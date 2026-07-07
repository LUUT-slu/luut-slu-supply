import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, MessageCircle, Download, RefreshCw, Loader2 } from "lucide-react";

interface ShadowRow {
  id: string;
  phone: string | null;
  full_name: string | null;
  created_at: string;
  claim_token: string | null;
  claimed_at: string | null;
  order_count: number;
  last_order_at: string | null;
}

const SITE_URL = typeof window !== "undefined" ? window.location.origin : "";

export function UnclaimedCustomersTab() {
  const [rows, setRows] = useState<ShadowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("customer_profiles")
      .select("id, phone, full_name, created_at, claim_token, claimed_at")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Failed to load customers");
      setLoading(false);
      return;
    }

    const ids = (profiles || []).map((p) => p.id);
    const counts: Record<string, { c: number; last: string | null }> = {};
    if (ids.length) {
      const { data: orders } = await supabase
        .from("orders")
        .select("customer_profile_id, created_at")
        .in("customer_profile_id", ids);
      for (const o of orders || []) {
        const k = (o as any).customer_profile_id as string;
        if (!counts[k]) counts[k] = { c: 0, last: null };
        counts[k].c += 1;
        if (!counts[k].last || new Date(o.created_at) > new Date(counts[k].last!))
          counts[k].last = o.created_at;
      }
    }

    setRows(
      (profiles || []).map((p) => ({
        ...p,
        order_count: counts[p.id]?.c || 0,
        last_order_at: counts[p.id]?.last || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.phone || "").toLowerCase().includes(q) ||
        (r.full_name || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const issueLink = async (profile_id: string, rotate = false): Promise<string | null> => {
    setIssuing(profile_id);
    try {
      const { data, error } = await supabase.functions.invoke("issue-claim-link", {
        body: { profile_id, rotate },
      });
      if (error || !data || (data as any).error) {
        toast.error((data as any)?.error || (error as any)?.message || "Failed");
        return null;
      }
      setRows((prev) => prev.map((r) => r.id === profile_id ? { ...r, claim_token: (data as any).token } : r));
      return (data as any).url as string;
    } finally {
      setIssuing(null);
    }
  };

  const copyLink = async (row: ShadowRow) => {
    let url = row.claim_token ? `${SITE_URL}/claim/${row.claim_token}` : null;
    if (!url) url = await issueLink(row.id);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Claim link copied");
  };

  const openWhatsApp = async (row: ShadowRow) => {
    let url = row.claim_token ? `${SITE_URL}/claim/${row.claim_token}` : null;
    if (!url) url = await issueLink(row.id);
    if (!url || !row.phone) return;
    const name = row.full_name ? `Hi ${row.full_name.split(" ")[0]}, ` : "Hey! ";
    const msg = `${name}this is Luut SLU 👋 Here's your private link to see all your past orders, exclusive discounts, and faster checkout:\n\n${url}\n\nJust enter your phone number to unlock. This link is only for you — don't share it.`;
    const phoneDigits = row.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const exportCsv = () => {
    const header = ["phone", "name", "orders", "last_order", "claim_url"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const url = r.claim_token ? `${SITE_URL}/claim/${r.claim_token}` : "(no token — click Copy Link first)";
      lines.push([
        r.phone || "",
        (r.full_name || "").replace(/,/g, " "),
        r.order_count,
        r.last_order_at || "",
        url,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unclaimed-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateAllTokens = async () => {
    const missing = filtered.filter((r) => !r.claim_token);
    if (!missing.length) { toast.info("All rows already have claim links."); return; }
    toast.info(`Generating ${missing.length} claim links…`);
    for (const r of missing) {
      // eslint-disable-next-line no-await-in-loop
      await issueLink(r.id);
    }
    toast.success("Done");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-base">
            {loading ? "Loading…" : `${filtered.length} unclaimed`}
          </span>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={generateAllTokens}>Generate all</Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" /> CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nothing to show.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Orders</th>
                  <th className="py-2 pr-3">Last order</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{r.phone || "—"}</td>
                    <td className="py-2 pr-3">{r.full_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-3">{r.order_count}</td>
                    <td className="py-2 pr-3">
                      {r.last_order_at ? new Date(r.last_order_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {r.claim_token ? (
                        <Badge variant="secondary">Link ready</Badge>
                      ) : (
                        <Badge variant="outline">Needs link</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => copyLink(r)} disabled={issuing === r.id}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openWhatsApp(r)} disabled={!r.phone || issuing === r.id}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => issueLink(r.id, true)} disabled={issuing === r.id} title="Rotate token">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
