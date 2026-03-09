import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import { Home, Trash2, ChevronUp, ChevronDown, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { updateSiteSetting, HomepageLayout, HomepageSection, DEFAULT_HOMEPAGE_LAYOUT } from "@/hooks/useSiteSettings";
import { HeroBannerEditor } from "@/components/admin/HeroBannerEditor";
import { FeaturedProductPicker } from "@/components/admin/FeaturedProductPicker";
import { useQueryClient } from "@tanstack/react-query";

const SECTION_TYPES = [
  { value: "category", label: "Category" },
  { value: "best_sellers", label: "Best Sellers (auto)" },
  { value: "trending", label: "Trending (auto)" },
  { value: "new_arrivals", label: "New Arrivals (auto)" },
  { value: "featured", label: "Featured (manual)" },
] as const;

interface HomepageEditorProps {
  initialLayout?: HomepageLayout;
}

export function HomepageEditor({ initialLayout }: HomepageEditorProps) {
  const queryClient = useQueryClient();
  const [layout, setLayout] = useState<HomepageLayout>(initialLayout || DEFAULT_HOMEPAGE_LAYOUT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (newLayout: HomepageLayout) => {
    setLayout(newLayout);
    setDirty(true);
  };

  // --- Section management ---
  const addSection = (type: HomepageSection["type"]) => {
    const newSection: HomepageSection = {
      id: `sec-${Date.now()}`,
      type,
      label: type === "category" ? "New Category" : SECTION_TYPES.find(t => t.value === type)?.label || type,
      limit: type === "trending" ? 6 : 4,
      enabled: true,
      ...(type === "featured" ? { featuredProductIds: [] } : {}),
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
      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      await queryClient.refetchQueries({ queryKey: ["site-settings"] });
      setDirty(false);
      toast.success("Homepage layout saved!");
    } catch (err) {
      toast.error("Failed to save layout");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Categories already used by category-type sections
  const usedSlugs = new Set(layout.sections.filter(s => s.type === "category").map(s => s.slug));
  const availableCategories = PRODUCT_CATEGORIES.filter(c => c.slug !== "other" && !usedSlugs.has(c.slug));

  return (
    <div className="space-y-4">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Home className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Homepage Layout</h3>
            <p className="text-xs text-muted-foreground">Manage hero banner &amp; sections</p>
          </div>
        </div>
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
            Save All
          </Button>
        )}
      </div>

      {/* Hero Banner */}
      <HeroBannerEditor
        hero={layout.hero}
        onChange={(hero) => update({ ...layout, hero })}
      />

      {/* Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sections</CardTitle>
          <CardDescription className="text-xs">Add, reorder, and configure homepage sections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {layout.sections.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No sections added yet</p>
          )}

          {layout.sections.map((section, index) => (
            <div
              key={section.id}
              className={`rounded-lg border p-3 space-y-2 ${section.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
            >
              {/* Top row: reorder, type badge, label, controls */}
              <div className="flex items-center gap-2">
                {/* Reorder */}
                <div className="flex flex-col">
                  <button onClick={() => moveSection(index, -1)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveSection(index, 1)} disabled={index === layout.sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Type badge */}
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary whitespace-nowrap">
                  {SECTION_TYPES.find(t => t.value === section.type)?.label || section.type}
                </span>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <Input
                    value={section.label}
                    onChange={(e) => updateSection(section.id, { label: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>

                {/* Limit */}
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground">Show</Label>
                  <Input
                    type="number" min={1} max={20}
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
                <button onClick={() => removeSection(section.id)} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Category slug picker (only for category type) */}
              {section.type === "category" && (
                <div className="pl-7">
                  <Select
                    value={section.slug || ""}
                    onValueChange={(slug) => {
                      const cat = PRODUCT_CATEGORIES.find(c => c.slug === slug);
                      updateSection(section.id, { slug, label: cat?.label || section.label });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs w-48">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.filter(c => c.slug !== "other").map(cat => (
                        <SelectItem key={cat.slug} value={cat.slug} className="text-xs">{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {section.slug && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">/{section.slug}</p>
                  )}
                </div>
              )}

              {/* Featured product picker */}
              {section.type === "featured" && (
                <div className="pl-7">
                  <FeaturedProductPicker
                    selectedIds={section.featuredProductIds || []}
                    onChange={(ids) => updateSection(section.id, { featuredProductIds: ids })}
                  />
                </div>
              )}

              {/* Auto section info */}
              {(section.type === "best_sellers" || section.type === "trending" || section.type === "new_arrivals") && (
                <p className="pl-7 text-[10px] text-muted-foreground italic">
                  {section.type === "best_sellers" && "Auto-populated from weekly sales data"}
                  {section.type === "trending" && "Auto-populated from in-stock products by views/clicks"}
                  {section.type === "new_arrivals" && "Auto-populated from newest product uploads"}
                </p>
              )}
            </div>
          ))}

          {/* Add section */}
          <div className="flex flex-wrap gap-2 pt-2">
            {availableCategories.length > 0 && (
              <Select onValueChange={(slug) => {
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
              }}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="+ Add category..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat.slug} value={cat.slug} className="text-xs">{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Quick-add other section types */}
            {["best_sellers", "trending", "new_arrivals", "featured"].map(type => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => addSection(type as HomepageSection["type"])}
              >
                + {SECTION_TYPES.find(t => t.value === type)?.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
