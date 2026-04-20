import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  PosterPreset,
  getBuiltinPresets,
  getCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
  validateExtractedPreset,
} from "@/lib/marketingPresets";

interface PresetPickerProps {
  activeId: string;
  onChange: (id: string) => void;
}

export function PresetPicker({ activeId, onChange }: PresetPickerProps) {
  const [customs, setCustoms] = useState<PosterPreset[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = () => setCustoms(getCustomPresets());
  useEffect(() => {
    refresh();
  }, []);

  const builtins = getBuiltinPresets();
  const all = [...builtins, ...customs];

  const handleSaved = (p: PosterPreset) => {
    saveCustomPreset(p);
    refresh();
    onChange(p.id);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {all.map((p) => (
          <PresetChip
            key={p.id}
            preset={p}
            active={p.id === activeId}
            onClick={() => onChange(p.id)}
            onDelete={
              p.source === "custom"
                ? () => {
                    deleteCustomPreset(p.id);
                    refresh();
                    if (activeId === p.id) onChange("hype");
                  }
                : undefined
            }
          />
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 snap-start flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-background hover:bg-accent px-3 py-2 text-xs font-medium touch-manipulation"
        >
          <Plus className="h-3.5 w-3.5" />
          From reference
        </button>
      </div>

      <UploadReferenceDialog open={open} onOpenChange={setOpen} onSaved={handleSaved} />
    </div>
  );
}

function PresetChip({
  preset,
  active,
  onClick,
  onDelete,
}: {
  preset: PosterPreset;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="relative shrink-0 snap-start">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex flex-col items-stretch gap-1 rounded-lg border px-2.5 py-2 min-w-[88px] touch-manipulation transition-colors",
          active
            ? "border-primary bg-primary/5 ring-2 ring-primary/30"
            : "border-border bg-background hover:bg-accent",
        )}
        aria-pressed={active}
      >
        <div className="flex h-6 items-center gap-1 rounded overflow-hidden">
          <div className="flex-1 h-full" style={{ background: preset.palette.bg }} />
          <div className="flex-1 h-full" style={{ background: preset.palette.surface }} />
          <div className="flex-1 h-full" style={{ background: preset.palette.accent }} />
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-semibold truncate">{preset.name}</span>
          {preset.source === "custom" && (
            <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
          )}
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
          aria-label="Delete preset"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function UploadReferenceDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (p: PosterPreset) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview("");
      setName("");
      setExtracting(false);
    }
  }, [open]);

  const onPick = (f: File) => {
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      toast.error("Image must be under 6MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ""));
    reader.readAsDataURL(f);
    if (!name) setName(f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40));
  };

  const handleExtract = async () => {
    if (!preview) {
      toast.error("Pick a reference image first");
      return;
    }
    if (!name.trim()) {
      toast.error("Give your preset a name");
      return;
    }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-extract-preset", {
        body: { imageDataUrl: preview },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const tokens = (data as any)?.tokens;
      const preset = validateExtractedPreset(tokens, name);
      if (!preset) {
        throw new Error("Could not parse extracted tokens");
      }
      toast.success(`Saved preset: ${preset.name}`);
      onSaved(preset);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add preset from reference</DialogTitle>
          <DialogDescription>
            Upload a poster you like. We extract only its design tokens (colors, density, badge &
            CTA shape) — never the product or text from your reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onPick(f);
            }}
          >
            {preview ? (
              <img
                src={preview}
                alt="reference"
                className="mx-auto max-h-44 rounded object-contain"
              />
            ) : (
              <div className="text-sm text-muted-foreground py-6">
                Drop an image here or tap to choose
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </div>

          <div>
            <Label className="text-xs">Preset name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. My Drop Style"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          <Button onClick={handleExtract} disabled={extracting || !preview} className="w-full gap-2">
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting tokens…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extract & save preset
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
