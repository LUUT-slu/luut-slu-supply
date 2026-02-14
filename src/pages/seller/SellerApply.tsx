import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/BackButton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { Store, Upload, Loader2 } from "lucide-react";

const LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort", "Rodney Bay", "Soufriere", "Other"];
const CATEGORIES = ["Clothing", "Accessories", "Shoes", "Bags", "Electronics", "Beauty", "Home", "Other"];

export default function SellerApply() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    email: "",
    shopName: "",
    phone: "",
    whatsapp: "",
    location: "",
    category: "",
    description: "",
    instagramUrl: "",
    facebookUrl: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }

    setUserId(session.user.id);

    const { data: profile } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profile) {
      if (profile.is_approved) {
        navigate("/seller/dashboard", { replace: true });
      } else {
        navigate("/seller/pending", { replace: true });
      }
      return;
    }

    setCheckingAuth(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !userId) return null;

    const fileExt = logoFile.name.split(".").pop();
    const fileName = `${userId}-logo-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("seller-assets")
      .upload(filePath, logoFile);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("seller-assets")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      toast.error("Please sign in first");
      return;
    }

    if (!formData.firstName.trim() || !formData.email.trim() || !formData.shopName.trim() || !formData.instagramUrl.trim() || !formData.whatsapp.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const logoUrl = await uploadLogo();

      const { error } = await supabase
        .from("seller_profiles")
        .insert({
          user_id: userId,
          seller_name: formData.shopName,
          phone: formData.phone || formData.whatsapp,
          whatsapp: formData.whatsapp,
          location: formData.location,
          categories: formData.category ? [formData.category] : [],
          shop_description: formData.description,
          instagram_url: formData.instagramUrl,
          logo_url: logoUrl,
          seller_status: "pending",
          is_approved: false,
          owner_first_name: formData.firstName,
          owner_email: formData.email,
          facebook_url: formData.facebookUrl || null,
        } as any);

      if (error) throw error;

      toast.success("Application submitted successfully!");

      // Notify admin via WhatsApp
      const adminPhone = "17587185478";
      const msg = `🆕 *NEW SELLER APPLICATION*\n\n👤 Name: ${formData.firstName}\n📧 Email: ${formData.email}\n🏪 Shop: ${formData.shopName}\n📞 WhatsApp: ${formData.whatsapp}\n📍 Location: ${formData.location || "Not specified"}\n🏷️ Category: ${formData.category || "Not specified"}\n📸 Instagram: ${formData.instagramUrl}\n\nPlease review in the admin panel.`;
      window.open(`https://wa.me/${adminPhone}?text=${encodeURIComponent(msg)}`, "_blank");

      navigate("/seller/pending", { replace: true });
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-6">
        <BackButton to="/" />
        
        <div className="mx-auto max-w-lg">
          <Card className="border-border/60">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Become a Seller</CardTitle>
              <CardDescription>
                Join our marketplace and start selling your products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>Shop Logo (Optional)</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-16 w-16 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* First Name */}
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Your first name"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                {/* Shop Name */}
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop / Brand Name *</Label>
                  <Input
                    id="shopName"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    placeholder="Enter your shop name"
                    required
                  />
                </div>

                {/* WhatsApp (required) */}
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Business Number *</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="758-xxx-xxxx"
                    required
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (if different)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                {/* Instagram (required) */}
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram Link *</Label>
                  <Input
                    id="instagram"
                    value={formData.instagramUrl}
                    onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/yourshop"
                    required
                  />
                </div>

                {/* Facebook (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook Link</Label>
                  <Input
                    id="facebook"
                    value={formData.facebookUrl}
                    onChange={(e) => setFormData({ ...formData, facebookUrl: e.target.value })}
                    placeholder="https://facebook.com/yourshop (optional)"
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your area" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Primary Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="What do you sell?" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">About Your Shop</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Tell us about your products and brand..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
