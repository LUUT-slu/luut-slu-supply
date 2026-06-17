import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VideoModule from "./marketing-studio/VideoModule";
import CreditsPanel from "./marketing-studio/CreditsPanel";
import PosterTab from "./marketing-studio/PosterTab";
import DisplayTab from "./marketing-studio/DisplayTab";
import LibraryTab from "./marketing-studio/LibraryTab";
import BrandStyleSelector from "./marketing-studio/BrandStyleSelector";
import type { BrandStyle } from "@/lib/marketingRouting";
import { useHybridProducts } from "@/hooks/useHybridProducts";

export default function MarketingStudio() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"poster" | "display" | "video" | "library">("poster");
  const [brandStyle, setBrandStyle] = useState<BrandStyle>("default");

  // VideoModule still uses a selected product directly; reuse the hook lightly.
  const { products } = useHybridProducts({ limit: 100 });
  const [videoProductId, setVideoProductId] = useState<string>("");
  const videoProduct =
    products.find((p) => p.id === videoProductId) || products[0];

  return (
    <AdminAuth>
      <Header />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Admin
              </Button>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Marketing Studio</h1>
                <p className="text-xs text-muted-foreground">
                  Pick a task — we route to the best AI model automatically.
                </p>
              </div>
            </div>
            <BrandStyleSelector value={brandStyle} onChange={setBrandStyle} />
          </div>

          <details className="mb-4 rounded-md border bg-muted/30">
            <summary className="cursor-pointer select-none px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              Credits & Status
            </summary>
            <div className="border-t p-4">
              <CreditsPanel />
            </div>
          </details>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="poster">Poster</TabsTrigger>
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="library">Library</TabsTrigger>
            </TabsList>

            <TabsContent value="poster">
              <PosterTab brandStyle={brandStyle} />
            </TabsContent>

            <TabsContent value="display">
              <DisplayTab brandStyle={brandStyle} />
            </TabsContent>

            <TabsContent value="video">
              <div className="space-y-4">
                <div className="rounded-md border bg-card p-4">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Product
                  </label>
                  <select
                    value={videoProductId}
                    onChange={(e) => setVideoProductId(e.target.value)}
                    className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {products.length === 0 && <option value="">Loading…</option>}
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
                <VideoModule
                  selectedProduct={videoProduct as any}
                  activeImageUrl={videoProduct?.images?.[0]?.url}
                  onOpenProductPicker={() => { /* no-op: picker handled inline */ }}
                />
              </div>
            </TabsContent>

            <TabsContent value="library">
              <LibraryTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AdminAuth>
  );
}
