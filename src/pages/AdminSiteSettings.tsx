import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminAuth } from "@/components/AdminAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Megaphone, ShoppingCart, EyeOff, Tag, Save, Loader2 } from "lucide-react";
import { useSiteSettings, updateSiteSetting, PopupSetting, CheckoutReminderSetting } from "@/hooks/useSiteSettings";
import { toast } from "sonner";

export default function AdminSiteSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSiteSettings();

  const [popups, setPopups] = useState<PopupSetting[]>([]);
  const [freezeCheckout, setFreezeCheckout] = useState(false);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [checkoutReminder, setCheckoutReminder] = useState<CheckoutReminderSetting>({
    enabled: false, code: "", message: "",
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setPopups(settings.popups);
      setFreezeCheckout(settings.freezeCheckout);
      setHideSoldOut(settings.hideSoldOut);
      setCheckoutReminder(settings.checkoutReminder);
    }
  }, [settings]);

  const handleSave = async (key: string, value: any) => {
    setSaving(key);
    try {
      await updateSiteSetting(key, value);
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Setting saved!");
    } catch (err) {
      toast.error("Failed to save setting");
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const updatePopup = (index: number, updates: Partial<PopupSetting>) => {
    const updated = [...popups];
    updated[index] = { ...updated[index], ...updates };
    setPopups(updated);
  };

  if (isLoading) {
    return (
      <AdminAuth>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminAuth>
    );
  }

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-8 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-display text-2xl md:text-3xl">Site Settings</h1>
              <p className="text-sm text-muted-foreground">Control storefront behavior</p>
            </div>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* ========== POPUPS MANAGER ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Megaphone className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <CardTitle>Popups Manager</CardTitle>
                    <CardDescription>Toggle promotional popups on the storefront</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {popups.map((popup, idx) => (
                  <div key={popup.id} className="space-y-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{popup.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {popup.id}</p>
                      </div>
                      <Switch
                        checked={popup.enabled}
                        onCheckedChange={(checked) => updatePopup(idx, { enabled: checked })}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={popup.frequency}
                          onValueChange={(v) => updatePopup(idx, { frequency: v as any })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="once_per_session">Once per session</SelectItem>
                            <SelectItem value="once_per_24h">Once per 24 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Button URL</Label>
                        <Input
                          className="mt-1"
                          value={popup.buttonUrl}
                          onChange={(e) => updatePopup(idx, { buttonUrl: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Start Date (optional)</Label>
                        <Input
                          className="mt-1"
                          type="datetime-local"
                          value={popup.startAt || ""}
                          onChange={(e) => updatePopup(idx, { startAt: e.target.value || null })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">End Date (optional)</Label>
                        <Input
                          className="mt-1"
                          type="datetime-local"
                          value={popup.endAt || ""}
                          onChange={(e) => updatePopup(idx, { endAt: e.target.value || null })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Pages (comma-separated: home, product, shop, all)</Label>
                      <Input
                        className="mt-1"
                        value={popup.pages.join(", ")}
                        onChange={(e) =>
                          updatePopup(idx, {
                            pages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}

                <Button
                  onClick={() => handleSave("popups", popups)}
                  disabled={saving === "popups"}
                  className="w-full"
                >
                  {saving === "popups" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Popups
                </Button>
              </CardContent>
            </Card>

            {/* ========== FREEZE CHECKOUT ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                      <ShoppingCart className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <CardTitle>Freeze Checkout</CardTitle>
                      <CardDescription>Temporarily disable all checkout flows</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={freezeCheckout}
                    onCheckedChange={(checked) => {
                      setFreezeCheckout(checked);
                      handleSave("freeze_checkout", checked);
                    }}
                  />
                </div>
              </CardHeader>
              {freezeCheckout && (
                <CardContent>
                  <p className="text-sm text-destructive">
                    ⚠️ Checkout is currently frozen. Customers cannot place orders.
                  </p>
                </CardContent>
              )}
            </Card>

            {/* ========== HIDE SOLD OUT ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                      <EyeOff className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle>Hide Sold-Out Products</CardTitle>
                      <CardDescription>Remove sold-out items from grids and search</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={hideSoldOut}
                    onCheckedChange={(checked) => {
                      setHideSoldOut(checked);
                      handleSave("hide_sold_out", checked);
                    }}
                  />
                </div>
              </CardHeader>
            </Card>

            {/* ========== CHECKOUT REMINDER ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Checkout Reminder</CardTitle>
                      <CardDescription>Show discount code reminder on cart/checkout</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={checkoutReminder.enabled}
                    onCheckedChange={(checked) => {
                      const updated = { ...checkoutReminder, enabled: checked };
                      setCheckoutReminder(updated);
                      handleSave("checkout_reminder", updated);
                    }}
                  />
                </div>
              </CardHeader>
              {checkoutReminder.enabled && (
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Discount Code</Label>
                    <Input
                      className="mt-1"
                      value={checkoutReminder.code}
                      onChange={(e) => setCheckoutReminder({ ...checkoutReminder, code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Reminder Message</Label>
                    <Input
                      className="mt-1"
                      value={checkoutReminder.message}
                      onChange={(e) => setCheckoutReminder({ ...checkoutReminder, message: e.target.value })}
                    />
                  </div>
                  <Button
                    onClick={() => handleSave("checkout_reminder", checkoutReminder)}
                    disabled={saving === "checkout_reminder"}
                    size="sm"
                  >
                    {saving === "checkout_reminder" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Reminder
                  </Button>
                </CardContent>
              )}
            </Card>
          </div>
        </main>
      </div>
    </AdminAuth>
  );
}
