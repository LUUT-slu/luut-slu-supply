import { useState } from "react";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadImage } from "@/lib/downloadImage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"] as const;
type Ratio = (typeof ASPECT_RATIOS)[number];
const MODEL_NAME = "ideogram-ai/ideogram-v3-turbo";

export default function TextToImageSection() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("1:1");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("Enter a prompt first");
      return;
    }
    setLoading(true);
    setImageUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders = { Authorization: `Bearer ${session?.access_token}` };

      const { data, error } = await supabase.functions.invoke("generate-poster-t2i", {
        body: { prompt: trimmed, aspectRatio },
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
        const { error: insertError } = await supabase
          .from("marketing_generated_images" as any)
          .insert({
            image_url: url,
            thumbnail_url: url,
            generation_type: "ai_poster",
            style: "text_to_image",
            aspect_ratio: aspectRatio,
            prompt_used: trimmed,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Text to Image</CardTitle>
        <p className="text-xs text-muted-foreground">Model: {MODEL_NAME}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your poster…"
          rows={4}
          className="resize-none"
        />

        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={aspectRatio === r ? "default" : "outline"}
              onClick={() => setAspectRatio(r)}
            >
              {r}
            </Button>
          ))}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={loading || !prompt.trim()}
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
