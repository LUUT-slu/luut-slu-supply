import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { AdminAuth } from "@/components/AdminAuth";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Pencil, Trash2, Calendar, Tag, Loader2 } from "lucide-react";
import {
  usePromotionCampaigns,
  useDeletePromotionCampaign,
  deriveStatus,
  PromotionCampaign,
  CampaignStatus,
} from "@/hooks/usePromotionCampaigns";
import { PromotionEditor } from "@/components/admin/PromotionEditor";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminGroupNav } from "@/components/admin/AdminGroupNav";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  draft: "Drafts",
};

const STATUS_COLOR: Record<CampaignStatus, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/30",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  expired: "bg-muted text-muted-foreground border-border",
  draft: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
};

function discountSummary(c: PromotionCampaign) {
  if (c.discount_type === "none") return "No discount";
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  if (c.discount_type === "fixed") return `EC$${Math.round(c.discount_value)} off`;
  return `EC$${Math.round(c.discount_value)} price`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PromotionsManager() {
  const { data: campaigns = [], isLoading } = usePromotionCampaigns();
  const del = useDeletePromotionCampaign();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionCampaign | null>(null);
  const [tab, setTab] = useState<CampaignStatus>("active");
  const [confirmDelete, setConfirmDelete] = useState<PromotionCampaign | null>(null);

  const grouped = useMemo(() => {
    const g: Record<CampaignStatus, PromotionCampaign[]> = {
      active: [],
      scheduled: [],
      expired: [],
      draft: [],
    };
    for (const c of campaigns) g[deriveStatus(c)].push(c);
    return g;
  }, [campaigns]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (c: PromotionCampaign) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Promotion deleted");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
      <AdminGroupNav group="marketing" />
        <main className="container flex-1 py-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <BackButton to="/admin" />
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500/10">
              <Megaphone className="h-5 w-5 text-fuchsia-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl md:text-2xl">Promotions Manager</h1>
              <p className="text-xs text-muted-foreground">
                Manually create and manage promo campaigns
              </p>
            </div>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Promotion
            </Button>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as CampaignStatus)}>
            <TabsList className="grid w-full grid-cols-4">
              {(["active", "scheduled", "expired", "draft"] as CampaignStatus[]).map((s) => (
                <TabsTrigger key={s} value={s}>
                  {STATUS_LABEL[s]}
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    {grouped[s].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {(["active", "scheduled", "expired", "draft"] as CampaignStatus[]).map((s) => (
              <TabsContent key={s} value={s} className="mt-4">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading campaigns
                  </div>
                ) : grouped[s].length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Megaphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No {STATUS_LABEL[s].toLowerCase()} promotions yet
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5"
                        onClick={openNew}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create one
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[s].map((c) => {
                      const status = deriveStatus(c);
                      return (
                        <Card key={c.id} className="overflow-hidden">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-semibold">{c.name}</h3>
                                <Badge
                                  variant="outline"
                                  className={`mt-1 text-[10px] ${STATUS_COLOR[status]}`}
                                >
                                  {c.promo_label}
                                </Badge>
                              </div>
                              <div className="flex gap-0.5">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(c)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setConfirmDelete(c)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {c.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {c.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {discountSummary(c)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(c.start_date)} → {formatDate(c.end_date)}
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t pt-2">
                              <span className="text-[11px] font-medium">
                                {c.product_refs.length} product{c.product_refs.length === 1 ? "" : "s"}
                              </span>
                              {c.product_refs.length > 0 && (
                                <div className="flex -space-x-2">
                                  {c.product_refs.slice(0, 4).map((r) =>
                                    r.image ? (
                                      <img
                                        key={r.id}
                                        src={r.image}
                                        alt=""
                                        className="h-6 w-6 rounded-full border-2 border-background object-cover"
                                      />
                                    ) : (
                                      <div
                                        key={r.id}
                                        className="h-6 w-6 rounded-full border-2 border-background bg-muted"
                                      />
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>

      <PromotionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        campaign={editing}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminAuth>
  );
}
