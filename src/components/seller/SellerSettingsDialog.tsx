import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Save, FileText, Upload, Trash2 } from "lucide-react";

interface SellerSettingsDialogProps {
  sellerId: string;
  userId: string;
  currentName: string;
  currentDocumentUrl?: string | null;
  onUpdated: () => void;
}

export function SellerSettingsDialog({ sellerId, userId, currentName, currentDocumentUrl, onUpdated }: SellerSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [sellerName, setSellerName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState(currentDocumentUrl || "");

  const handleSaveName = async () => {
    if (!sellerName.trim()) {
      toast.error("Business name cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("seller_profiles")
      .update({ seller_name: sellerName.trim() })
      .eq("id", sellerId);

    if (error) {
      toast.error("Failed to update name");
    } else {
      toast.success("Business name updated!");
      onUpdated();
    }
    setSaving(false);
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    const filePath = `${userId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("user-documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("user-documents")
      .getPublicUrl(filePath);

    // Save to seller profile
    const { error: updateError } = await supabase
      .from("seller_profiles")
      .update({ document_url: urlData.publicUrl } as any)
      .eq("id", sellerId);

    if (updateError) {
      toast.error("Failed to save document link");
    } else {
      setDocumentUrl(urlData.publicUrl);
      toast.success("Document uploaded!");
      onUpdated();
    }
    setUploading(false);
  };

  const handleRemoveDoc = async () => {
    const { error } = await supabase
      .from("seller_profiles")
      .update({ document_url: null } as any)
      .eq("id", sellerId);

    if (!error) {
      setDocumentUrl("");
      toast.success("Document removed");
      onUpdated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seller Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Business Name */}
          <div className="space-y-2">
            <Label>Business Name</Label>
            <p className="text-xs text-muted-foreground">This is the name customers will see</p>
            <div className="flex gap-2">
              <Input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Your business name"
              />
              <Button onClick={handleSaveName} disabled={saving} size="sm" className="shrink-0">
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </div>

          {/* PDF Upload */}
          <div className="space-y-2">
            <Label>Business Document (PDF)</Label>
            <p className="text-xs text-muted-foreground">Upload a PDF document for your account (max 10MB)</p>
            
            {documentUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-border p-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  View Document
                </a>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleRemoveDoc}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadPdf}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-center hover:border-primary/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Uploading..." : "Click to upload PDF"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
