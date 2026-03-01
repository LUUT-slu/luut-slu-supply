import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AdminAuth } from "@/components/AdminAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ArrowLeft, Megaphone, Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { useSiteSettings, updateSiteSetting, PopupSetting } from "@/hooks/useSiteSettings";
import { toast } from "sonner";

const emptyPopup: PopupSetting = {
  id: "",
  name: "",
  enabled: false,
  frequency: "once_per_session",
  startAt: null,
  endAt: null,
  pages: ["all"],
  buttonUrl: "/shop",
};

export default function PopupsManager() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useSiteSettings();

  const [popups, setPopups] = useState<PopupSetting[]>([]);
  const [editPopup, setEditPopup] = useState<PopupSetting | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setPopups(settings.popups);
  }, [settings]);

  const savePopups = async (updated: PopupSetting[]) => {
    setSaving(true);
    try {
      await updateSiteSetting("popups", updated);
      setPopups(updated);
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Popups saved!");
    } catch {
      toast.error("Failed to save popups");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (idx: number, enabled: boolean) => {
    const updated = [...popups];
    updated[idx] = { ...updated[idx], enabled };
    savePopups(updated);
  };

  const handleEdit = (idx: number) => {
    setEditPopup({ ...popups[idx] });
    setEditIndex(idx);
    setIsNew(false);
  };

  const handleCreate = () => {
    const id = `popup_${Date.now()}`;
    setEditPopup({ ...emptyPopup, id });
    setEditIndex(null);
    setIsNew(true);
  };

  const handleSaveEdit = () => {
    if (!editPopup) return;
    let updated: PopupSetting[];
    if (isNew) {
      updated = [...popups, editPopup];
    } else if (editIndex !== null) {
      updated = [...popups];
      updated[editIndex] = editPopup;
    } else return;

    savePopups(updated);
    setEditPopup(null);
  };

  const handleDelete = () => {
    if (deleteIndex === null) return;
    const updated = popups.filter((_, i) => i !== deleteIndex);
    savePopups(updated);
    setDeleteIndex(null);
  };

  if (isLoading) {
    return (
      <AdminAuth>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </AdminAuth>
    );
  }

  return (
    <AdminAuth>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex-1 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-display text-xl md:text-2xl">Popups Manager</h1>
                <p className="text-xs text-muted-foreground">Create and manage promotional popups</p>
              </div>
            </div>
            <Button onClick={handleCreate} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Popup
            </Button>
          </div>

          <div className="max-w-2xl space-y-3">
            {popups.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No popups yet. Create one to get started.</p>
                </CardContent>
              </Card>
            )}

            {popups.map((popup, idx) => (
              <Card key={popup.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{popup.name || popup.id}</p>
                      {popup.enabled ? (
                        <span className="text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">LIVE</span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">OFF</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {popup.frequency === "once_per_session" ? "Once/session" : "Once/24h"} · Pages: {popup.pages.join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={popup.enabled} onCheckedChange={(v) => handleToggle(idx, v)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(idx)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteIndex(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editPopup} onOpenChange={(open) => { if (!open) setEditPopup(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Create Popup" : "Edit Popup"}</DialogTitle>
          </DialogHeader>
          {editPopup && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Popup Name</Label>
                <Input className="mt-1" value={editPopup.name} onChange={(e) => setEditPopup({ ...editPopup, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Button URL</Label>
                <Input className="mt-1" value={editPopup.buttonUrl} onChange={(e) => setEditPopup({ ...editPopup, buttonUrl: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Frequency</Label>
                  <Select value={editPopup.frequency} onValueChange={(v) => setEditPopup({ ...editPopup, frequency: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once_per_session">Once per session</SelectItem>
                      <SelectItem value="once_per_24h">Once per 24h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Enabled</Label>
                  <div className="mt-2">
                    <Switch checked={editPopup.enabled} onCheckedChange={(v) => setEditPopup({ ...editPopup, enabled: v })} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input className="mt-1" type="datetime-local" value={editPopup.startAt || ""} onChange={(e) => setEditPopup({ ...editPopup, startAt: e.target.value || null })} />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input className="mt-1" type="datetime-local" value={editPopup.endAt || ""} onChange={(e) => setEditPopup({ ...editPopup, endAt: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Pages (comma-separated: home, product, shop, all)</Label>
                <Input
                  className="mt-1"
                  value={editPopup.pages.join(", ")}
                  onChange={(e) => setEditPopup({ ...editPopup, pages: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPopup(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Popup?</AlertDialogTitle>
            <AlertDialogDescription>This popup will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminAuth>
  );
}
