import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Image, Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { HeroConfig, DEFAULT_HERO } from "@/hooks/useSiteSettings";

interface HeroBannerEditorProps {
  hero: HeroConfig;
  onChange: (hero: HeroConfig) => void;
}

export function HeroBannerEditor({ hero, onChange }: HeroBannerEditorProps) {
  const [uploading, setUploading] = useState(false);

  const update = (partial: Partial<HeroConfig>) => {
    onChange({ ...hero, ...partial });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "webp";
      const path = `homepage/hero-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("seller-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("seller-assets")
        .getPublicUrl(path);

      update({ imageUrl: publicUrl });
      toast.success("Banner image uploaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
            <Image className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <CardTitle className="text-sm">Hero Banner</CardTitle>
            <CardDescription className="text-xs">Upload image, edit text & buttons</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image upload */}
        <div>
          <Label className="text-xs font-medium">Banner Image</Label>
          {hero.imageUrl ? (
            <div className="relative mt-1.5 rounded-lg overflow-hidden border border-border">
              <img src={hero.imageUrl} alt="Hero banner" className="w-full h-32 object-cover" />
              <button
                onClick={() => update({ imageUrl: null })}
                className="absolute top-2 right-2 rounded-full bg-background/80 p-1 hover:bg-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="mt-1.5 flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Upload banner image</span>
                </div>
              )}
            </label>
          )}
          {hero.imageUrl && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading..." : "Replace image"}
            </label>
          )}
        </div>

        {/* Text fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Heading</Label>
            <Input
              className="mt-1 h-8 text-xs"
              placeholder="Optional heading text"
              value={hero.heading}
              onChange={(e) => update({ heading: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Subheading</Label>
            <Input
              className="mt-1 h-8 text-xs"
              placeholder="Optional subheading"
              value={hero.subheading}
              onChange={(e) => update({ subheading: e.target.value })}
            />
          </div>
        </div>

        {/* Primary button */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Primary Button Text</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={hero.buttonText}
              onChange={(e) => update({ buttonText: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Primary Button Link</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={hero.buttonLink}
              onChange={(e) => update({ buttonLink: e.target.value })}
            />
          </div>
        </div>

        {/* Secondary button */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Secondary Button Text</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={hero.secondaryButtonText}
              onChange={(e) => update({ secondaryButtonText: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Secondary Button Link</Label>
            <Input
              className="mt-1 h-8 text-xs"
              value={hero.secondaryButtonLink}
              onChange={(e) => update({ secondaryButtonLink: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
