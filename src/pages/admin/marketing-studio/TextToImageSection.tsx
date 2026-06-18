import { useState } from "react";
import { Loader2, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBrandStyleDef, type BrandStyle } from "@/lib/marketingRouting";

const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
type Ratio = (typeof ASPECT_RATIOS)[number];
const MODEL_NAME = "ideogram-ai/ideogram-v3-quality";

const CAMPAIGN_TYPES = [
  "Sale",
  "Promotion",
  "New Arrival",
  "Limited Drop",
  "Clearance",
  "Brand Awareness",
  "Event",
] as const;
type CampaignType = (typeof CAMPAIGN_TYPES)[number];

const STYLES = ["Clean", "Luxury", "Bold", "Hype", "Modern", "Minimal"] as const;
type StyleType = (typeof STYLES)[number];

interface Props {
  brandStyle: BrandStyle;
}

export default function TextToImageSection({ brandStyle }: Props) {
  const [campaignType, setCampaignType] = useState<CampaignType>("Sale");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [keyDetail, setKeyDetail] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [locations, setLocations] = useState("Castries · Gros Islet · Vieux Fort");
  const [style, setStyle] = useState<StyleType>("Clean");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("1:1");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const buildPrompt = () => {
    const brandDef = getBrandStyleDef(brandStyle);
    const brandSnippet = brandDef?.snippet?.trim();
    const brandLabel = brandDef?.label;

    const parts: string[] = [];
    parts.push(`${style} ${campaignType} poster design.`);
    if (headline.trim()) parts.push(`Main headline: "${headline.trim()}".`);
    if (subheadline.trim()) parts.push(`Subheadline: "${subheadline.trim()}".`);
    if (keyDetail.trim()) parts.push(`Key detail prominently displayed: "${keyDetail.trim()}".`);
    if (dateRange.trim()) parts.push(`Dates: "${dateRange.trim()}".`);
    if (locations.trim()) parts.push(`Locations: "${locations.trim()}".`);
    if (brandLabel && brandStyle !== "default") {
      parts.push(`Brand style: ${brandLabel}.`);
    }
    if (brandSnippet) parts.push(brandSnippet + ".");
    parts.push(
      "Typography-driven layout, high-impact composition, clear visual hierarchy, professional marketing poster, sharp legible text.",
    );
    if (additionalNotes.trim()) parts.push(`Additional context: ${additionalNotes.trim()}.`);
    return parts.join(" ");
  };

  const handleBuildPrompt = () => {
    if (!headline.trim() && !subheadline.trim() && !keyDetail.trim()) {
      toast.error("Add at least a headline, subheadline, or key detail");
      return;
    }
    setFinalPrompt(buildPrompt());
    toast.success("Prompt built — edit below, then generate");
  };

  const handleGenerate = async () => {
    if (!finalPrompt.trim()) {
      toast.error("Build a prompt first");
      return;
    }
    setLoading(true);
    setImageUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = { Authorization: `Bearer ${session?.access_token}` };

      const { data, error } = await supabase.functions.invoke("generate-poster-t2i", {
        body: { prompt: finalPrompt.trim(), aspectRatio },
        headers: authHeaders,
      });
      const rawError = (data as any)?.error || error?.message;
      if (rawError) {
        const friendly = /insufficient credit|out of credit/i.test(rawError)
          ? "Replicate is out of credit. Top up and try again."
          : rawError;
        toast.error(friendly);
        return;
      }

      const url = (data as any)?.imageUrl;
      if (!url) {
        toast.error("Generation failed");
        return;
      }
      setImageUrl(url);
      toast.success("Image generated");

      // Save to library (non-blocking)
      try {
        const title =
          headline.trim() ||
          subheadline.trim() ||
          keyDetail.trim() ||
          `${campaignType} poster`;
        const { error: insertError } = await supabase
          .from("marketing_generated_images" as any)
          .insert({
            image_url: url,
            thumbnail_url: url,
            generation_type: "ai_poster",
            style: "text_to_image",
            aspect_ratio: aspectRatio,
            prompt_used: finalPrompt.trim(),
            product_title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
            model_used: MODEL_NAME,
          } as any);
        if (insertError) throw insertError;
        toast.success("Saved to library");
      } catch (e: any) {
        toast.error(e?.message || "Could not save to library");
      }
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const Pill = <T extends string>({
    value,
    current,
    onClick,
  }: {
    value: T;
    current: T;
    onClick: () => void;
  }) => (
    <Button
      key={value}
      type="button"
      size="sm"
      variant={current === value ? "default" : "outline"}
      onClick={onClick}
      className="rounded-full"
    >
      {value}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Text to Image</CardTitle>
        <p className="text-xs text-muted-foreground">Model: {MODEL_NAME}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Campaign Type</Label>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_TYPES.map((c) => (
              <Pill key={c} value={c} current={campaignType} onClick={() => setCampaignType(c)} />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="t2i-headline">Headline</Label>
            <Input
              id="t2i-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="CLEARANCE SALE"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t2i-subheadline">Subheadline</Label>
            <Input
              id="t2i-subheadline"
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              placeholder="Everything Must Go"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t2i-keydetail">Key Detail</Label>
            <Input
              id="t2i-keydetail"
              value={keyDetail}
              onChange={(e) => setKeyDetail(e.target.value)}
              placeholder="50% OFF"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t2i-daterange">Date Range</Label>
            <Input
              id="t2i-daterange"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              placeholder="June 25 — June 30"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="t2i-locations">Locations</Label>
            <Input
              id="t2i-locations"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Style</Label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Pill key={s} value={s} current={style} onClick={() => setStyle(s)} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Aspect Ratio</Label>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((r) => (
              <Pill key={r} value={r} current={aspectRatio} onClick={() => setAspectRatio(r)} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="t2i-notes" className="text-xs uppercase tracking-wide">
            Theme / Additional Notes
          </Label>
          <Textarea
            id="t2i-notes"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="e.g. tropical island vibes, neon accents, warm sunset colors…"
            rows={3}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loading}
          onClick={handleBuildPrompt}
        >
          <Wand2 className="mr-2 h-4 w-4" /> Build Prompt
        </Button>

        {finalPrompt && (
          <div className="space-y-2">
            <Label htmlFor="t2i-final-prompt" className="text-xs uppercase tracking-wide">
              Final Prompt — Edit before generating
            </Label>
            <Textarea
              id="t2i-final-prompt"
              value={finalPrompt}
              onChange={(e) => setFinalPrompt(e.target.value)}
              rows={5}
            />
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={handleGenerate}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        )}

        {imageUrl && (
          <div className="space-y-3 pt-2">
            <img src={imageUrl} alt="Generated" className="w-full rounded" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => downloadImage(imageUrl, "luut-text-to-image.png")}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}