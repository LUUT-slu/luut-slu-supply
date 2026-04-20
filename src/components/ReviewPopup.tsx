import { useState, useRef } from "react";
import { Star, X, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_COMMENT = 200;
const MAX_IMAGES = 2;

interface ReviewPopupProps {
  productHandle?: string;
  productTitle?: string;
}

export function ReviewPopup({ productHandle, productTitle }: ReviewPopupProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRating(0);
    setHovered(0);
    setName("");
    setComment("");
    setImages([]);
    setPreviews(p => { p.forEach(URL.revokeObjectURL); return []; });
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    const accepted = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .slice(0, remaining);
    if (accepted.length === 0) return;
    setImages(prev => [...prev, ...accepted]);
    setPreviews(prev => [...prev, ...accepted.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a rating"); return; }
    if (comment.length > MAX_COMMENT) return;
    setSubmitting(true);

    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `reviews/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("seller-assets").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("seller-assets").getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("reviews").insert({
        reviewer_name: name.trim() || null,
        rating,
        comment: comment.trim() || null,
        image_urls: imageUrls.length > 0 ? imageUrls : [],
        product_handle: productHandle || null,
        product_title: productTitle || null,
      });
      if (error) throw error;

      // Fire-and-forget admin alert: new review submitted
      supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "review_submitted",
          payload: {
            rating,
            reviewer_name: name.trim() || null,
            comment: comment.trim() || null,
            product_title: productTitle || null,
          },
        },
      }).catch(() => {});

      toast.success("Thank you! Your review has been submitted.");
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size={productHandle ? "sm" : "default"}
          variant={productHandle ? "outline" : "default"}
          className="gap-2 font-body"
        >
          <Star className="h-4 w-4" />
          {productHandle ? "Write a Review" : "Leave a Review"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            {productTitle ? `Review: ${productTitle}` : "Share Your Experience"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Star Rating */}
          <div>
            <p className="text-sm font-medium mb-2">Rating *</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  className="p-1 touch-manipulation"
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      s <= (hovered || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium">Name (optional)</label>
            <Input
              placeholder="Anonymous"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="mt-1"
            />
          </div>

          {/* Comment */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Comment</label>
              <span className={`text-xs ${comment.length > MAX_COMMENT ? "text-destructive" : "text-muted-foreground"}`}>
                {comment.length}/{MAX_COMMENT}
              </span>
            </div>
            <Textarea
              placeholder="Tell us about your experience…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={MAX_COMMENT}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="text-sm font-medium">Photos (max {MAX_IMAGES})</label>
            <div className="mt-1 flex gap-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative h-20 w-20 rounded-md overflow-hidden border border-border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => addImages(e.target.files)}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0 || comment.length > MAX_COMMENT}
            className="w-full"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
