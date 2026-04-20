import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Copy, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type CopyType = "ad_copy" | "instagram_caption" | "whatsapp_promo" | "facebook_marketplace";

interface ProductPayload {
  name: string;
  price?: string | number;
  description?: string;
  category?: string;
  stockStatus?: string;
  brandName?: string;
  meetupLocations?: string;
  cta?: string;
  urgencyText?: string;
}

interface CopyPanelProps {
  product: ProductPayload;
}

const SECTIONS: { key: CopyType; title: string; helper: string }[] = [
  { key: "ad_copy", title: "Ad Copy", helper: "Headline, body, CTA for paid ads" },
  { key: "instagram_caption", title: "Instagram Caption", helper: "Caption + hashtags" },
  { key: "whatsapp_promo", title: "WhatsApp Promo", helper: "Short blast message" },
  { key: "facebook_marketplace", title: "Facebook Marketplace", helper: "Listing description" },
];

export function CopyPanel({ product }: CopyPanelProps) {
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generate = async (type: CopyType) => {
    if (!product.name) {
      toast.error("Pick a product first");
      return;
    }
    setLoading((s) => ({ ...s, [type]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing-copy", {
        body: { type, product },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const result = (data as any)?.result;
      setResults((s) => ({ ...s, [type]: formatResult(type, result) }));
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setLoading((s) => ({ ...s, [type]: false }));
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied");
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map((sec) => (
        <Card key={sec.key}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">{sec.title}</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sec.helper}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => generate(sec.key)}
                disabled={loading[sec.key]}
              >
                {loading[sec.key] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate
              </Button>
            </div>
          </CardHeader>
          {results[sec.key] && (
            <CardContent className="space-y-2">
              <Textarea
                value={results[sec.key]}
                onChange={(e) => setResults((s) => ({ ...s, [sec.key]: e.target.value }))}
                rows={5}
                className="text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => copy(sec.key, results[sec.key])}
              >
                {copiedKey === sec.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </Button>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function formatResult(type: CopyType, r: any): string {
  if (!r) return "";
  switch (type) {
    case "ad_copy":
      return [
        `Headline: ${r.headline}`,
        ``,
        r.primary_text,
        ``,
        r.short_description,
        ``,
        `CTA: ${r.cta}`,
      ].join("\n");
    case "instagram_caption":
      return `${r.caption}\n\n${(r.hashtags || []).map((h: string) => `#${h.replace(/^#/, "")}`).join(" ")}`;
    case "whatsapp_promo":
      return r.text || "";
    case "facebook_marketplace":
      return r.description || "";
    default:
      return JSON.stringify(r, null, 2);
  }
}
