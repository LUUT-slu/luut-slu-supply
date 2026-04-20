import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Loader2, Send, RefreshCw, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import {
  updateSiteSetting,
  NotificationSettings,
  AdminAlertKey,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "@/hooks/useSiteSettings";
import { toast } from "sonner";

const ALERT_LABELS: Record<AdminAlertKey, string> = {
  new_order: "New Order",
  seller_application: "Seller Approval Request",
  customer_signup: "Customer Signup",
  contact_form: "Contact Form",
  payment_issue: "Payment Issue",
  seller_product: "Product Submission",
  low_stock: "Low Stock",
  review_submitted: "Review Submitted",
  order_status_change: "Order Status Changed",
  general: "General System Alerts",
};

interface AlertLog {
  id: string;
  alert_type: string;
  recipient: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface Props {
  initialSettings?: NotificationSettings;
}

export function NotificationsSection({ initialSettings }: Props) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationSettings>(
    initialSettings || DEFAULT_NOTIFICATION_SETTINGS
  );
  const [savingField, setSavingField] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<string | null>(null);

  useEffect(() => {
    if (initialSettings) setSettings(initialSettings);
  }, [initialSettings]);

  const logsQuery = useQuery({
    queryKey: ["admin-alert-logs"],
    queryFn: async (): Promise<AlertLog[]> => {
      const { data, error } = await supabase
        .from("admin_alert_logs" as any)
        .select("id, alert_type, recipient, subject, status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as unknown as AlertLog[];
    },
    refetchOnWindowFocus: false,
  });

  const persist = async (next: NotificationSettings, fieldKey: string) => {
    setSavingField(fieldKey);
    try {
      await updateSiteSetting("notifications", next);
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save");
    } finally {
      setSavingField(null);
    }
  };

  const updateField = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    persist(next, String(key));
  };

  const toggleAlert = (key: AdminAlertKey, value: boolean) => {
    const next = { ...settings, alerts: { ...settings.alerts, [key]: value } };
    setSettings(next);
    persist(next, `alerts.${key}`);
  };

  const sendTest = async (type: AdminAlertKey, payload: Record<string, any>) => {
    setTestingType(type);
    try {
      const { data, error } = await supabase.functions.invoke("send-admin-alert", {
        body: { type, payload, test: true },
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success(`Test ${ALERT_LABELS[type]} sent to ${settings.adminEmail}`);
      } else {
        toast.error(`Test failed: ${(data as any)?.detail?.message || (data as any)?.skipped || "unknown"}`);
      }
      setTimeout(() => logsQuery.refetch(), 800);
    } catch (e: any) {
      console.error(e);
      toast.error(`Test failed: ${e.message || "unknown"}`);
    } finally {
      setTestingType(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Bell className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-sm">Notifications & Alerts</CardTitle>
            <CardDescription className="text-xs">
              Control admin email alerts. Master switch turns everything off.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ===== EMAIL SETTINGS ===== */}
        <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Settings</h3>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Admin email (where alerts go)</Label>
            <div className="flex gap-2">
              <Input
                className="h-9 text-sm"
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                placeholder="admin@example.com"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => persist(settings, "adminEmail")}
                disabled={savingField === "adminEmail"}
              >
                {savingField === "adminEmail" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Sender email (optional override)</Label>
            <div className="flex gap-2">
              <Input
                className="h-9 text-sm"
                value={settings.senderEmail}
                onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                placeholder="Luut SLU <orders@yourdomain.com>"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => persist(settings, "senderEmail")}
                disabled={savingField === "senderEmail"}
              >
                {savingField === "senderEmail" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Leave empty to use the RESEND_FROM_EMAIL environment variable.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md bg-background p-2.5">
            <div>
              <Label className="text-xs font-medium">Master switch (all alerts)</Label>
              <p className="text-[10px] text-muted-foreground">Turn off to silence every notification.</p>
            </div>
            <Switch
              checked={settings.masterEnabled}
              onCheckedChange={(v) => updateField("masterEnabled", v)}
            />
          </div>

          <Button
            size="sm"
            className="w-full"
            onClick={() => sendTest("general", { title: "Test Alert", message: "If you got this, alerts are working.", source: "Site Settings" })}
            disabled={testingType !== null}
          >
            {testingType === "general"
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Send className="mr-2 h-4 w-4" />}
            Send test email
          </Button>
        </section>

        {/* ===== ALERT TOGGLES ===== */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alert Types</h3>
          <div className="space-y-1.5 rounded-lg border">
            {(Object.keys(ALERT_LABELS) as AdminAlertKey[]).map((key, i) => (
              <div
                key={key}
                className={`flex items-center justify-between p-2.5 ${i > 0 ? "border-t" : ""}`}
              >
                <Label htmlFor={`alert-${key}`} className="text-xs font-medium cursor-pointer">
                  {ALERT_LABELS[key]}
                </Label>
                <Switch
                  id={`alert-${key}`}
                  checked={settings.alerts[key] !== false}
                  onCheckedChange={(v) => toggleAlert(key, v)}
                  disabled={!settings.masterEnabled}
                />
              </div>
            ))}
          </div>
          {!settings.masterEnabled && (
            <p className="text-[10px] text-muted-foreground">
              Master switch is OFF — individual toggles are disabled.
            </p>
          )}
        </section>

        {/* ===== BEHAVIOR ===== */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Behavior</h3>
          <div className="rounded-lg border">
            <div className="flex items-center justify-between p-2.5">
              <div>
                <Label className="text-xs font-medium">Send instantly</Label>
                <p className="text-[10px] text-muted-foreground">Default. Emails go out the moment events fire.</p>
              </div>
              <Switch checked={settings.instantSend} onCheckedChange={(v) => updateField("instantSend", v)} />
            </div>
            <div className="flex items-center justify-between border-t p-2.5">
              <div>
                <Label className="text-xs font-medium">Group alerts (batch)</Label>
                <p className="text-[10px] text-muted-foreground">Reserved for future use.</p>
              </div>
              <Switch checked={settings.batchMode} onCheckedChange={(v) => updateField("batchMode", v)} />
            </div>
          </div>
        </section>

        {/* ===== TEST ALERTS ===== */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Simulate Alerts</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              size="sm" variant="outline" disabled={testingType !== null}
              onClick={() => sendTest("new_order", {
                order_number: 9999, customer_name: "Test Customer",
                total_price: 120.00, location: "Castries", pickup_time: "Sample Date",
              })}
            >
              {testingType === "new_order" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              New Order
            </Button>
            <Button
              size="sm" variant="outline" disabled={testingType !== null}
              onClick={() => sendTest("seller_application", {
                name: "Test Seller", business_name: "Test Brand",
                whatsapp: "+1758...", location: "Gros Islet",
              })}
            >
              {testingType === "seller_application" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Seller Request
            </Button>
            <Button
              size="sm" variant="outline" disabled={testingType !== null}
              onClick={() => sendTest("customer_signup", {
                full_name: "Jane Doe", email: "jane@example.com",
              })}
            >
              {testingType === "customer_signup" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Signup
            </Button>
          </div>
        </section>

        {/* ===== RECENT LOGS ===== */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Alerts</h3>
            <Button size="sm" variant="ghost" onClick={() => logsQuery.refetch()} disabled={logsQuery.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${logsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="rounded-lg border">
            {logsQuery.isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : logsQuery.data && logsQuery.data.length > 0 ? (
              <div className="divide-y">
                {logsQuery.data.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {log.status === "sent" ? (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                        ) : log.status === "skipped" ? (
                          <MinusCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                        )}
                        <span className="truncate text-xs font-medium">
                          {ALERT_LABELS[log.alert_type as AdminAlertKey] || log.alert_type}
                        </span>
                      </div>
                      {log.subject && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{log.subject}</p>
                      )}
                      {log.error_message && (
                        <p className="mt-0.5 truncate text-[10px] text-destructive">{log.error_message}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[9px] py-0 h-4 ${
                          log.status === "sent" ? "border-emerald-500/40 text-emerald-600" :
                          log.status === "skipped" ? "border-muted-foreground/40 text-muted-foreground" :
                          "border-destructive/40 text-destructive"
                        }`}
                      >
                        {log.status}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-muted-foreground">No alerts yet.</p>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
