import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface PreviewRow {
  vendor: string;
  location: string;
  products: number;
  variants: number;
  totalQty: number;
  status: "will_create" | "skipped";
  existingPoId: string | null;
  overlapCount: number;
}

export function ImportShopifyDraftsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const runPreview = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-shopify-po-drafts", {
        body: { dryRun: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setPreview((data as any).preview || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to preview");
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-shopify-po-drafts", {
        body: { dryRun: false },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const created = (data as any).created?.length || 0;
      const skipped = (data as any).skipped?.length || 0;
      toast.success(`Imported ${created} draft PO${created === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`);
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      onOpenChange(false);
      setPreview(null);
    } catch (e: any) {
      toast.error(e?.message || "Import failed");
    } finally {
      setConfirming(false);
    }
  };

  const willCreate = preview?.filter((r) => r.status === "will_create").length || 0;
  const skippedCount = preview?.filter((r) => r.status === "skipped").length || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPreview(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Purchase Orders from Shopify</DialogTitle>
        </DialogHeader>

        {!preview && !loading && (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Pull products, stock, vendor and cost data from Shopify into draft purchase orders.
              Each vendor + location becomes one draft PO. Existing draft POs are detected to avoid duplicates.
            </p>
            <p className="text-xs">Missing fields (customs, supplier link, ETA) are left blank for you to fill before finalizing.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Shopify products…
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {willCreate} will be created · {skippedCount} skipped
            </div>
            <div className="max-h-80 overflow-auto border border-border/50 rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Variants</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No products with stock found</TableCell></TableRow>
                  )}
                  {preview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.vendor}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell className="text-right">{r.products}</TableCell>
                      <TableCell className="text-right">{r.variants}</TableCell>
                      <TableCell className="text-right">{r.totalQty}</TableCell>
                      <TableCell>
                        {r.status === "skipped" ? (
                          <span className="text-xs text-muted-foreground">Draft exists ({r.overlapCount} overlap)</span>
                        ) : (
                          <span className="text-xs text-primary">Will create</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {!preview ? (
            <Button onClick={runPreview} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Preview
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={confirming}>Back</Button>
              <Button onClick={runImport} disabled={confirming || willCreate === 0}>
                {confirming && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Create {willCreate} draft PO{willCreate === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
