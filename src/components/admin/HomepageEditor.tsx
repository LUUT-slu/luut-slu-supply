import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Trash2, ChevronUp, ChevronDown, Save, Loader2, Eye, EyeOff, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateSiteSetting, HomepageLayout, HomepageSection, DEFAULT_HOMEPAGE_LAYOUT } from "@/hooks/useSiteSettings";
import { HeroBannerEditor } from "@/components/admin/HeroBannerEditor";
import { FeaturedProductPicker } from "@/components/admin/FeaturedProductPicker";
import { useQueryClient } from "@tanstack/react-query";
import { useShopifyCollections } from "@/hooks/useShopifyCollections";

const SECTION_TYPES = [
  { value: "category", label: "Shopify Collection" },
  { value: "promo_collection", label: "Promo / Clearance" },
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

  // Live Shopify collections — single source of truth for category sections
  const { collections, loading: loadingCollections, error: collectionsError } = useShopifyCollections(100);

  const update = (newLayout: HomepageLayout) => {
    setLayout(newLayout);
    setDirty(true);
  };

  const addSection = (type: HomepageSection["type"]) => {
    const newSection: HomepageSection = {
      id: `sec-${Date.now()}`,
      type,
      label: type === "category" ? "New Collection" : SECTION_TYPES.find(t => t.value === type)?.label || type,
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

  const refreshCollections = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shopify-collections"] });
    toast.success("Refreshed Shopify collections");
  };

  const usedHandles = new Set(layout.sections.filter(s => s.type === "category").map(s => s.slug));
  const availableCollections = collections.filter(c => !usedHandles.has(c.handle));

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
            <p className="text-xs text-muted-foreground">Live-synced with Shopify collections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={refreshCollections} title="Refresh Shopify collections">
            <RefreshCw className="h-3 w-3" />
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
              Save All
            </Button>
          )}
        </div>
      </div>

      {collectionsError && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
          Could not load Shopify collections. Section pickers will be empty until Shopify is reachable.
        </div>
      )}

      {/* Hero Banner */}
      <HeroBannerEditor
        hero={layout.hero}
        onChange={(hero) => update({ ...layout, hero })}
      />

      {/* Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sections</CardTitle>
          <CardDescription className="text-xs">
            Add, reorder, and configure homepage sections. Collection sections pull live from Shopify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {layout.sections.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No sections added yet</p>
          )}

          {layout.sections.map((section, index) => {
            const matchedCollection = section.type === "category" && section.slug
              ? collections.find(c => c.handle === section.slug)
              : undefined;
            const collectionMissing =
              section.type === "category" && section.slug && !loadingCollections && !matchedCollection;

            return (
              <div
                key={section.id}
                className={`rounded-lg border p-3 space-y-2 ${section.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'}`}
              >
                {/* Top row */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button onClick={() => moveSection(index, -1)} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => moveSection(index, 1)} disabled={index === layout.sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary whitespace-nowrap">
                    {SECTION_TYPES.find(t => t.value === section.type)?.label || section.type}
                  </span>

                  <div className="flex-1 min-w-0">
                    <Input
                      value={section.label}
                      onChange={(e) => updateSection(section.id, { label: e.target.value })}
                      placeholder="Section title"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Show</Label>
                    <Input
                      type="number" min={1} max={20}
                      value={section.limit}
                      onChange={(e) => updateSection(section.id, { limit: parseInt(e.target.value) || 4 })}
                      className="h-7 w-14 text-xs text-center"
                    />
                  </div>

                  <button
                    onClick={() => updateSection(section.id, { enabled: !section.enabled })}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title={section.enabled ? "Hide section" : "Show section"}
                  >
                    {section.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>

                  <button onClick={() => removeSection(section.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Subtitle row (all section types) */}
                <div className="pl-7">
                  <Input
                    value={section.subtitle || ""}
                    onChange={(e) => updateSection(section.id, { subtitle: e.target.value })}
                    placeholder="Optional subtitle (e.g. 'Fresh drops, newest styles')"
                    className="h-7 text-xs"
                  />
                </div>

                {/* Shopify collection picker */}
                {section.type === "category" && (
                  <div className="pl-7 space-y-1">
                    <Select
                      value={section.slug || ""}
                      onValueChange={(handle) => {
                        const col = collections.find(c => c.handle === handle);
                        updateSection(section.id, {
                          slug: handle,
                          collectionTitle: col?.title,
                          // Auto-fill label if it's still a placeholder
                          label: section.label === "New Collection" || section.label === section.collectionTitle
                            ? (col?.title || section.label)
                            : section.label,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-64">
                        <SelectValue placeholder={loadingCollections ? "Loading collections..." : "Select Shopify collection..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.length === 0 && !loadingCollections && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">No Shopify collections found</div>
                        )}
                        {collections.map(col => (
                          <SelectItem key={col.handle} value={col.handle} className="text-xs">
                            {col.title}
                            <span className="ml-2 text-muted-foreground">/{col.handle}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {section.slug && !collectionMissing && (
                      <p className="text-[10px] text-muted-foreground">
                        Links to <code>/shop/{section.slug}</code>
                      </p>
                    )}
                    {collectionMissing && (
                      <p className="flex items-center gap-1 text-[10px] text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Collection "{section.slug}" unavailable — section is hidden from customers.
                      </p>
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

                {/* Promo collection picker */}
                {section.type === "promo_collection" && (
                  <div className="pl-7 space-y-2">
                    <Select
                      value={section.promoCollectionHandle || ""}
                      onValueChange={(handle) => {
                        const col = collections.find(c => c.handle === handle);
                        updateSection(section.id, {
                          promoCollectionHandle: handle,
                          slug: handle,
                          collectionTitle: col?.title,
                          label: section.label === "Promo / Clearance" || !section.label
                            ? `${col?.title || "Promo"} — On Sale`
                            : section.label,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-64">
                        <SelectValue placeholder={loadingCollections ? "Loading collections..." : "Select promo collection..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.map(col => (
                          <SelectItem key={col.handle} value={col.handle} className="text-xs">
                            {col.title}
                            <span className="ml-2 text-muted-foreground">/{col.handle}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Input
                        value={section.badgeLabel || ""}
                        onChange={(e) => updateSection(section.id, { badgeLabel: e.target.value })}
                        placeholder="Badge label (e.g. CLEARANCE, SALE)"
                        className="h-7 text-xs w-56"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={section.autoPrioritize !== false}
                          onChange={(e) => updateSection(section.id, { autoPrioritize: e.target.checked })}
                          className="h-3 w-3"
                        />
                        Auto-prioritize when promotion is active
                      </label>
                    </div>

                    <p className="text-[10px] text-muted-foreground italic">
                      Only displays products with an active discount. Hides automatically when no items are on sale.
                    </p>
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
            );
          })}

          {/* Add section */}
          <div className="flex flex-wrap gap-2 pt-2">
            {availableCollections.length > 0 && (
              <Select onValueChange={(handle) => {
                const col = collections.find(c => c.handle === handle);
                if (!col) return;
                const newSection: HomepageSection = {
                  id: `sec-${Date.now()}`,
                  type: "category",
                  slug: col.handle,
                  collectionTitle: col.title,
                  label: col.title,
                  limit: 4,
                  enabled: true,
                };
                update({ ...layout, sections: [...layout.sections, newSection] });
              }}>
                <SelectTrigger className="h-8 text-xs w-56">
                  <SelectValue placeholder={loadingCollections ? "Loading..." : "+ Add Shopify collection..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableCollections.map(col => (
                    <SelectItem key={col.handle} value={col.handle} className="text-xs">
                      {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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
