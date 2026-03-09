import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { Home, Plus, Trash2, ChevronUp, ChevronDown, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { updateSiteSetting } from "@/hooks/useSiteSettings";
import { useQueryClient } from "@tanstack/react-query";

export interface HomepageSection {
  id: string;
  type: "category";
  slug: string;
  label: string;
  limit: number;
  enabled: boolean;
}

export interface HomepageLayout {
  sections: HomepageSection[];
  showTrending: boolean;
  showBestSellers: boolean;
}

const DEFAULT_LAYOUT: HomepageLayout = {
  sections: [],
  showTrending: true,
  showBestSellers: true,
};

interface HomepageEditorProps {
  initialLayout?: HomepageLayout;
}

export function HomepageEditor({ initialLayout }: HomepageEditorProps) {
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<HomepageLayout>(initialLayout || DEFAULT_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const usedSlugs = new Set(layout.sections.map(s => s.slug));
  const availableCategories = PRODUCT_CATEGORIES.filter(c => c.slug !== "other" && !usedSlugs.has(c.slug));

  const update = (newLayout: HomepageLayout) => {
    setLayout(newLayout);
    setDirty(true);
  };

  const addSection = (slug: string) => {
    const cat = PRODUCT_CATEGORIES.find(c => c.slug === slug);
    if (!cat) return;
    const newSection: HomepageSection = {
      id: `sec-${Date.now()}`,
      type: "category",
      slug: cat.slug,
      label: cat.label,
      limit: 4,
      enabled: true,
    };
    update({ ...layout, sections: [...layout.sections, newSection] });
  };

  const removeSection = (id: string) => {
    update({ ...layout, sections: layout.sections.filter(s => s.id !== id) });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= layout.sections.length) return;
    const sections = [...layout.sections];
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    update({ ...layout, sections });
  };

  const updateSection = (id: string, updates: Partial<HomepageSection>) => {
    update({
      ...layout,
      sections: layout.sections.map(s => s.id === id ? { ...s, ...updates } : s),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSiteSetting("homepage_layout", layout);
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      setDirty(false);
      toast.success("Homepage layout saved!");
    } catch (err) {
      toast.error("Failed to save layout");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Home className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-sm">Homepage Layout</CardTitle>
              <CardDescription className="text-xs">Manage category sections on the homepage</CardDescription>
            </div>
          </div>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
              Save
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Global toggles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show "What's Trending" section</Label>
            <Switch
              checked={layout.showTrending}
              onCheckedChange={(checked) => update({ ...layout, showTrending: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show "Best Sellers" section</Label>
            <Switch
              checked={layout.showBestSellers}
              onCheckedChange={(checked) => update({ ...layout, showBestSellers: checked })}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Section list */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Category Sections</Label>
          {layout.sections.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No category sections added yet</p>
          )}
          {layout.sections.map((section, index) => (
            <div
              key={section.id}
              className={`flex items-center gap-2 rounded-lg border p-2 ${section.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
            >
              {/* Reorder */}
              <div className="flex flex-col">
                <button
                  onClick={() => moveSection(index, -1)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveSection(index, 1)}
                  disabled={index === layout.sections.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <Input
                  value={section.label}
                  onChange={(e) => updateSection(section.id, { label: e.target.value })}
                  className="h-7 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5 pl-1">/{section.slug}</p>
              </div>

              {/* Limit */}
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Show</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={section.limit}
                  onChange={(e) => updateSection(section.id, { limit: parseInt(e.target.value) || 4 })}
                  className="h-7 w-14 text-xs text-center"
                />
              </div>

              {/* Toggle */}
              <button
                onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                className="text-muted-foreground hover:text-foreground p-1"
                title={section.enabled ? "Hide section" : "Show section"}
              >
                {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>

              {/* Delete */}
              <button
                onClick={() => removeSection(section.id)}
                className="text-muted-foreground hover:text-destructive p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add section */}
        {availableCategories.length > 0 && (
          <div className="flex items-center gap-2">
            <Select onValueChange={addSection}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Add a category section..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(cat => (
                  <SelectItem key={cat.slug} value={cat.slug} className="text-xs">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
