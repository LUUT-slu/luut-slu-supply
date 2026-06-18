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
      const { data, error } = await supabase.functions.invoke("text-to-image", {
        body: { prompt: trimmed, aspect_ratio: aspectRatio },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const errMsg = (data as any)?.error || error?.message;
      if (errMsg) {
        const friendly = /insufficient credit|out of credit/i.test(errMsg)
          ? "Replicate is out of credit. Top up and try again."
          : errMsg;
        toast.error(friendly);
        return;
      }
      const url = (data as any)?.imageUrl;
      if (!url) {
        toast.error("No image returned");
        return;
      }
      setImageUrl(url);
      toast.success("Image generated");
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
