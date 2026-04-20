import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Megaphone, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useSiteSettings,
  updateSiteSetting,
  DEFAULT_MARKETING_STUDIO,
  MarketingStudioSettings,
} from "@/hooks/useSiteSettings";

export function MarketingDefaultsCard() {
  const { data } = useSiteSettings();
  const qc = useQueryClient();
  const [m, setM] = useState<MarketingStudioSettings>(DEFAULT_MARKETING_STUDIO);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.marketingStudio) setM(data.marketingStudio);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await updateSiteSetting("marketing_studio", m);
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Marketing defaults saved");
    } catch (e) {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-500/10">
            <Megaphone className="h-4 w-4 text-fuchsia-500" />
          </div>
          <div>
            <CardTitle className="text-sm">Marketing Studio Defaults</CardTitle>
            <CardDescription className="text-xs">
              Brand text and CTAs used when generating IG stories, posts and ads
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Brand Name</Label>
          <Input className="mt-1" value={m.brandName} onChange={(e) => setM({ ...m, brandName: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Default CTA</Label>
          <Input className="mt-1" value={m.defaultCta} onChange={(e) => setM({ ...m, defaultCta: e.target.value })} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Examples: "DM to order", "Available now", "Cop in DM", "Link in bio"
          </p>
        </div>
        <div>
          <Label className="text-xs">Brand Logo URL</Label>
          <Input
            className="mt-1"
            placeholder="https://... (square PNG works best)"
            value={m.brandLogoUrl}
            onChange={(e) => setM({ ...m, brandLogoUrl: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Meetup Locations</Label>
          <Input className="mt-1" value={m.meetupLocations} onChange={(e) => setM({ ...m, meetupLocations: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Urgency Text</Label>
          <Input className="mt-1" value={m.urgencyText} onChange={(e) => setM({ ...m, urgencyText: e.target.value })} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-2.5">
          <div>
            <Label className="text-xs font-medium">Show price by default</Label>
            <p className="text-[10px] text-muted-foreground">Toggle on creatives</p>
          </div>
          <Switch checked={m.showPriceByDefault} onCheckedChange={(v) => setM({ ...m, showPriceByDefault: v })} />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
