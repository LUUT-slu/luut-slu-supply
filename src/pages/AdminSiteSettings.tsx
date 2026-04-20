import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { AdminAuth } from "@/components/AdminAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ShoppingCart, EyeOff, Tag, Save, Loader2, Wifi, CheckCircle2, Palette } from "lucide-react";
import { useSiteSettings, updateSiteSetting, CheckoutReminderSetting, ColorVariantCardsSetting, HomepageLayout } from "@/hooks/useSiteSettings";
import { PopupsSection } from "@/components/admin/PopupsSection";
import { DiscountsSection } from "@/components/admin/DiscountsSection";
import { HomepageEditor } from "@/components/admin/HomepageEditor";
import { NotificationsSection } from "@/components/admin/NotificationsSection";
import { MarketingDefaultsCard } from "@/components/marketing/MarketingDefaultsCard";
import { toast } from "sonner";

export default function AdminSiteSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSiteSettings();

  const [freezeCheckout, setFreezeCheckout] = useState(false);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [checkoutReminder, setCheckoutReminder] = useState<CheckoutReminderSetting>({
    enabled: false, code: "", message: "",
  });
  const [colorVariantCards, setColorVariantCards] = useState<ColorVariantCardsSetting>({
    enabled: false, showOnlyInStock: true,
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFreezeCheckout(settings.freezeCheckout);
      setHideSoldOut(settings.hideSoldOut);
      setCheckoutReminder(settings.checkoutReminder);
      setColorVariantCards(settings.colorVariantCards);
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
              <h1 className="font-display text-xl md:text-2xl">Site Settings</h1>
              <p className="text-xs text-muted-foreground">Control storefront behavior, marketing & promotions</p>
            </div>
          </div>

          <div className="space-y-8 max-w-2xl">
            {/* ========== HOMEPAGE LAYOUT ========== */}
            <HomepageEditor initialLayout={settings?.homepageLayout} />

            <Separator />

            {/* ========== NOTIFICATIONS & ALERTS ========== */}
            <NotificationsSection initialSettings={settings?.notifications} />

            <Separator />

            {/* ========== MARKETING STUDIO DEFAULTS ========== */}
            <MarketingDefaultsCard />

            <Separator />

            {/* ========== SHOPIFY CONNECTION ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Wifi className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Shopify Connection</CardTitle>
                      <CardDescription className="text-xs">Diagnostics, scopes, token status</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Run tests to verify scope &amp; token health</p>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate("/admin/connection-health")}>
                  <Wifi className="h-4 w-4" />
                  Open Connection Health
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* ========== DISCOUNTS MANAGER ========== */}
            <section>
              <DiscountsSection />
            </section>

            <Separator />

            {/* ========== POPUPS MANAGER ========== */}
            <section>
              <PopupsSection initialPopups={settings?.popups || []} />
            </section>

            <Separator />

            {/* ========== COLOR VARIANT CARDS ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                      <Palette className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Color Variant Cards</CardTitle>
                      <CardDescription className="text-xs">Show separate cards for each color/style variant</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={colorVariantCards.enabled}
                    onCheckedChange={(checked) => {
                      const updated = { ...colorVariantCards, enabled: checked };
                      setColorVariantCards(updated);
                      handleSave("color_variant_cards", updated);
                    }}
                  />
                </div>
              </CardHeader>
              {colorVariantCards.enabled && (
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Products with Color, Style, or Design options will display as separate cards. Size variants remain on the product page.
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-medium">Show only in-stock options</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Hide out-of-stock color options from the grid
                      </p>
                    </div>
                    <Switch
                      checked={colorVariantCards.showOnlyInStock}
                      onCheckedChange={(checked) => {
                        const updated = { ...colorVariantCards, showOnlyInStock: checked };
                        setColorVariantCards(updated);
                        handleSave("color_variant_cards", updated);
                      }}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* ========== FREEZE CHECKOUT ========== */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                      <ShoppingCart className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Freeze Checkout</CardTitle>
                      <CardDescription className="text-xs">Temporarily disable all checkout flows</CardDescription>
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                      <EyeOff className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Hide Sold-Out Products</CardTitle>
                      <CardDescription className="text-xs">Remove sold-out items from grids and search</CardDescription>
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Tag className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Checkout Reminder</CardTitle>
                      <CardDescription className="text-xs">Show discount code reminder on cart/checkout</CardDescription>
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
