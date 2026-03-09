import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SellerProduct {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
}

interface FeaturedProductPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function FeaturedProductPicker({ selectedIds, onChange }: FeaturedProductPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SellerProduct[]>([]);
  const [selected, setSelected] = useState<SellerProduct[]>([]);
  const [searching, setSearching] = useState(false);

  // Load selected products on mount
  useEffect(() => {
    if (selectedIds.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("seller_products")
        .select("id, name, price, images")
        .in("id", selectedIds);
      if (data) setSelected(data as SellerProduct[]);
    })();
  }, []);

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("seller_products")
      .select("id, name, price, images")
      .ilike("name", `%${q}%`)
      .eq("status", "active")
      .limit(10);
    setResults((data as SellerProduct[]) || []);
    setSearching(false);
  };

  const addProduct = (product: SellerProduct) => {
    if (selectedIds.includes(product.id)) return;
    const newSelected = [...selected, product];
    setSelected(newSelected);
    onChange(newSelected.map(p => p.id));
    setQuery("");
    setResults([]);
  };

  const removeProduct = (id: string) => {
    const newSelected = selected.filter(p => p.id !== id);
    setSelected(newSelected);
    onChange(newSelected.map(p => p.id));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Featured Products</Label>

      {/* Selected products */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(p => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary"
            >
              {p.name}
              <button onClick={() => removeProduct(p.id)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 pl-8 text-xs"
          placeholder="Search products to add..."
          value={query}
          onChange={(e) => search(e.target.value)}
        />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {results
            .filter(r => !selectedIds.includes(r.id))
            .map(product => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors"
              >
                {product.images?.[0] && (
                  <img src={product.images[0]} alt="" className="h-7 w-7 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground">${product.price}</p>
                </div>
                <Plus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
