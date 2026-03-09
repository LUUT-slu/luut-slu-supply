import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface CreateSellerDialogProps {
  onCreated: () => void;
}

// A placeholder user_id for unlinked seller profiles
const PLACEHOLDER_USER_ID = "00000000-0000-0000-0000-000000000000";

export function CreateSellerDialog({ onCreated }: CreateSellerDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    seller_name: "",
    location: "",
    whatsapp: "",
    phone: "",
    instagram_url: "",
    shop_description: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!form.seller_name.trim()) {
      toast.error("Business name is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("seller_profiles").insert({
        user_id: PLACEHOLDER_USER_ID,
        seller_name: form.seller_name.trim(),
        location: form.location.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        phone: form.phone.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        shop_description: form.shop_description.trim() || null,
        is_approved: true,
        seller_status: "approved",
        approved_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success(`${form.seller_name} created successfully`);
      setForm({ seller_name: "", location: "", whatsapp: "", phone: "", instagram_url: "", shop_description: "" });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create seller");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
        <Plus className="h-4 w-4" />
        Add Seller
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Seller Account</DialogTitle>
            <DialogDescription>
              Pre-create a seller profile. You can assign it to a real user later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="seller_name">Business Name *</Label>
              <Input
                id="seller_name"
                placeholder="e.g. Island Threads"
                value={form.seller_name}
                onChange={(e) => handleChange("seller_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. Castries"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="+1 758..."
                  value={form.whatsapp}
                  onChange={(e) => handleChange("whatsapp", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 758..."
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input
                id="instagram_url"
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(e) => handleChange("instagram_url", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="shop_description">Description</Label>
              <Textarea
                id="shop_description"
                placeholder="Brief description of the seller..."
                value={form.shop_description}
                onChange={(e) => handleChange("shop_description", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
