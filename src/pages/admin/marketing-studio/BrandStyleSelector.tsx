import { useEffect, useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import {
  BUILTIN_BRAND_STYLES,
  loadCustomBrandStyles,
  saveCustomBrandStyles,
  type BrandStyle,
  type BrandStyleDef,
} from "@/lib/marketingRouting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function BrandStyleSelector({
  value,
  onChange,
}: {
  value: BrandStyle;
  onChange: (b: BrandStyle) => void;
}) {
  const [custom, setCustom] = useState<BrandStyleDef[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSnippet, setNewSnippet] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    setCustom(loadCustomBrandStyles());
  }, []);

  const all = [...BUILTIN_BRAND_STYLES, ...custom];

  const addCustom = () => {
    const label = newLabel.trim();
    const snippet = newSnippet.trim();
    if (!label || !snippet) {
      toast.error("Name and style description are required");
      return;
    }
    const key = `custom:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    const def: BrandStyleDef = {
      key,
      label,
      description: newDescription.trim() || "Custom brand style",
      snippet,
      custom: true,
    };
    const next = [...custom, def];
    setCustom(next);
    saveCustomBrandStyles(next);
    onChange(key);
    setNewLabel("");
    setNewSnippet("");
    setNewDescription("");
    setAddOpen(false);
    toast.success(`Saved "${label}" brand style`);
  };

  const removeCustom = (key: string) => {
    const next = custom.filter((s) => s.key !== key);
    setCustom(next);
    saveCustomBrandStyles(next);
    if (value === key) onChange("default");
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Brand Style
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      >
        {all.map((b) => (
          <option key={b.key} value={b.key}>
            {b.custom ? `★ ${b.label}` : b.label}
          </option>
        ))}
      </select>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="About brand styles"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How brand styles influence your creations</DialogTitle>
            <DialogDescription>
              Each brand style appends a short instruction snippet to every prompt so the look stays
              consistent across posters and display images.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {all.map((b) => (
              <div key={b.key} className="rounded border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {b.label}
                    {b.custom && (
                      <span className="ml-2 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        Custom
                      </span>
                    )}
                  </div>
                  {b.custom && (
                    <button
                      type="button"
                      onClick={() => removeCustom(b.key)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete custom style"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
                {b.snippet && (
                  <p className="mt-2 rounded bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-foreground/80">
                    {b.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="rounded-md border bg-background p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Add custom brand style"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create custom brand style</DialogTitle>
            <DialogDescription>
              Saved on this device. Every poster and display generated while this style is selected
              will append your description to the prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Caribbean Pastel"
              />
            </div>
            <div>
              <Label className="text-xs">Short description (for the info panel)</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Soft pastel palette, sun-bleached, breezy"
              />
            </div>
            <div>
              <Label className="text-xs">Style prompt snippet (gets appended to every prompt)</Label>
              <Textarea
                rows={4}
                value={newSnippet}
                onChange={(e) => setNewSnippet(e.target.value)}
                placeholder="pastel Caribbean palette, soft natural light, sun-bleached tropical mood, editorial composition"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Write it as descriptive keywords, like a photography brief.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCustom}>Save style</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
