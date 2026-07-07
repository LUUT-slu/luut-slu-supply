import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePurchaseOrders, useCreatePO, STATUS_LABELS, POStatus } from "@/hooks/usePurchaseOrders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { POStatusBadge } from "@/components/purchase-orders/POStatusBadge";
import { Plus, Package, ArrowLeft, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminGroupNav } from "@/components/admin/AdminGroupNav";

export default function PurchaseOrdersList({ basePath }: { basePath: "/admin/purchase-orders" | "/seller/purchase-orders" }) {
  const navigate = useNavigate();
  const { data: pos = [], isLoading } = usePurchaseOrders();
  const createPO = useCreatePO();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const isAdmin = basePath.startsWith("/admin");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const po = await createPO.mutateAsync({ name: name.trim() });
      navigate(`${basePath}/${po.id}`);
    } finally { setCreating(false); }
  };

  const homeHref = basePath.startsWith("/admin") ? "/admin" : "/seller";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to={homeHref} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
            <h1 className="text-lg font-semibold">Purchase Orders</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/reports`)}>
            <BarChart3 className="h-4 w-4 mr-1" /> Reports
          </Button>
        </div>
      </header>
      {isAdmin && <AdminGroupNav group="fulfillment" />}

      <main className="container mx-auto px-4 py-4 max-w-3xl space-y-4">
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">New Purchase Order</p>
            <div className="flex gap-2">
              <Input placeholder="PO name (e.g. Beanies — Nov drop)" value={name} onChange={e => setName(e.target.value)} />
              <Button onClick={handleCreate} disabled={!name.trim() || creating}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pos.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-10 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No purchase orders yet</p>
              <p className="text-sm text-muted-foreground">Create your first PO to start tracking incoming stock and profit.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pos.map(po => (
              <Card key={po.id} className="border-border/60 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`${basePath}/${po.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{po.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {po.supplier_name || "—"} · {po.expected_arrival_date || "no ETA"}
                      </p>
                    </div>
                    <POStatusBadge status={po.status as POStatus} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-muted-foreground">Invested</p><p className="font-medium">EC${Number(po.total_cost).toFixed(2)}</p></div>
                    <div><p className="text-muted-foreground">Exp. profit</p><p className="font-medium text-primary">EC${Number(po.total_expected_profit).toFixed(2)}</p></div>
                    <div><p className="text-muted-foreground">Avg margin</p><p className="font-medium">{Number(po.avg_margin).toFixed(0)}%</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
