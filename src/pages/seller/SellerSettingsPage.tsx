import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SellerNav } from "@/components/seller/SellerNav";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, FileText, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SellerSettingsPage() {
  const navigate = useNavigate();
  const { profile, user, loading, refreshProfile } = useSellerProfile();
  const [sellerName, setSellerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nameInitialized, setNameInitialized] = useState(false);

  // Initialize name once profile loads
  if (profile && !nameInitialized) {
    setSellerName(profile.seller_name);
    setNameInitialized(true);
  }

  const handleSaveName = async () => {
    if (!sellerName.trim() || !profile) {
      toast.error("Business name cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("seller_profiles")
      .update({ seller_name: sellerName.trim() })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update name");
    } else {
      toast.success("Business name updated!");
      refreshProfile();
    }
    setSaving(false);
  };

  const docUrl = (profile as any)?.document_url as string | null;

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.type !== "application/pdf") { toast.error("Only PDF files"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }

    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("user-documents").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("user-documents").getPublicUrl(path);
    await supabase.from("seller_profiles").update({ document_url: urlData.publicUrl } as any).eq("id", profile!.id);
    toast.success("Document uploaded!");
    refreshProfile();
    setUploading(false);
  };

  const handleRemoveDoc = async () => {
    if (!profile) return;
    await supabase.from("seller_profiles").update({ document_url: null } as any).eq("id", profile.id);
    toast.success("Document removed");
    refreshProfile();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SellerNav
        sellerName={profile?.seller_name}
        logoUrl={profile?.logo_url || undefined}
        sellerId={profile?.id}
      />
      <main className="container flex-1 py-6 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/seller/dashboard")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="font-display text-2xl mb-6">Seller Settings</h1>

        <div className="space-y-6">
          {/* Business Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Name</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">This is the name customers will see on your products and profile</p>
              <div className="flex gap-2">
                <Input
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Your business name"
                />
                <Button onClick={handleSaveName} disabled={saving} className="shrink-0">
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PDF Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Upload a PDF document for your account (max 10MB)</p>
              {docUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-border p-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <a href={docUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
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
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 hover:border-primary/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload PDF"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seller ID */}
          {profile?.seller_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Seller ID</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">Customers can search for you using this ID</p>
                <p className="font-mono text-lg font-semibold">{profile.seller_id}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
