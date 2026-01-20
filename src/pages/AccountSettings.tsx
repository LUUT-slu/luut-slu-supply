import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Phone, MapPin, FileText, LogOut, Save, Edit2, Check, X, ArrowLeft, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const LOCATIONS = [
  "Castries",
  "Gros Islet",
  "Vieux Fort",
  "Soufriere",
  "Dennery",
  "Micoud",
  "Laborie",
  "Choiseul",
  "Anse La Raye",
  "Canaries",
];

interface CustomerProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  meetup_notes: string | null;
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    full_name: "",
    email: "",
    phone: "",
    preferred_location: "",
    meetup_notes: "",
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/login");
      } else {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    setIsLoading(true);
    
    // Fetch customer profile
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } else if (data) {
      setProfile(data);
      setEditValues({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        preferred_location: data.preferred_location || "",
        meetup_notes: data.meetup_notes || "",
      });
    }

    // Fetch partner profile
    const { data: partner } = await supabase
      .from("partner_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setPartnerProfile(partner);

    // Fetch seller profile
    const { data: seller } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setSellerProfile(seller);
    
    setIsLoading(false);
  };

  const handleSaveField = async (field: string) => {
    if (!user || !profile) return;
    
    setIsSaving(true);
    
    const { error } = await supabase
      .from("customer_profiles")
      .update({ [field]: editValues[field as keyof typeof editValues] || null })
      .eq("user_id", user.id);
    
    if (error) {
      toast.error("Failed to update");
      console.error(error);
    } else {
      setProfile({ ...profile, [field]: editValues[field as keyof typeof editValues] || null });
      toast.success("Saved!");
      setEditingField(null);
    }
    
    setIsSaving(false);
  };

  const handleCancelEdit = (field: string) => {
    setEditValues({
      ...editValues,
      [field]: profile?.[field as keyof CustomerProfile] || "",
    });
    setEditingField(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <div className="flex items-center justify-center py-16">
            <div className="animate-pulse text-muted-foreground">Loading your account...</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="mb-8">
          <h1 className="font-display text-3xl">Account Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and preferences
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Section */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Full Name</Label>
                {editingField === "full_name" ? (
                  <div className="flex gap-2">
                    <Input
                      value={editValues.full_name}
                      onChange={(e) => setEditValues({ ...editValues, full_name: e.target.value })}
                      placeholder="Enter your name"
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveField("full_name")} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleCancelEdit("full_name")}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{profile?.full_name || "Not set"}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditingField("full_name")}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Contact Info Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Contact Info
              </CardTitle>
              <CardDescription>How we can reach you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Email Address</Label>
                {editingField === "email" ? (
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={editValues.email}
                      onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveField("email")} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleCancelEdit("email")}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{profile?.email || "Not set"}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditingField("email")}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Phone Number</Label>
                {editingField === "phone" ? (
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      value={editValues.phone}
                      onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                      placeholder="+1 (758) 000-0000"
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveField("phone")} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleCancelEdit("phone")}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{profile?.phone || "Not set"}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditingField("phone")}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Preferences Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Preferences
              </CardTitle>
              <CardDescription>Your order preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preferred Location */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preferred Pickup Location</Label>
                {editingField === "preferred_location" ? (
                  <div className="flex gap-2">
                    <Select
                      value={editValues.preferred_location}
                      onValueChange={(value) => setEditValues({ ...editValues, preferred_location: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => handleSaveField("preferred_location")} disabled={isSaving}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleCancelEdit("preferred_location")}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{profile?.preferred_location || "Not set"}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditingField("preferred_location")}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Meetup Notes */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Meetup Notes</Label>
                {editingField === "meetup_notes" ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editValues.meetup_notes}
                      onChange={(e) => setEditValues({ ...editValues, meetup_notes: e.target.value })}
                      placeholder="Any preferences for meetups? (e.g., preferred time, landmarks, etc.)"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleCancelEdit("meetup_notes")}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSaveField("meetup_notes")} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm">{profile?.meetup_notes || "No notes added"}</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditingField("meetup_notes")}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Business Portals Section */}
        {(partnerProfile || sellerProfile) && (
          <div className="mt-8 pt-6 border-t">
            <h2 className="font-display text-lg mb-4">Business Portals</h2>
            <div className="flex flex-wrap gap-3">
              {partnerProfile && (
                <Link to="/partner">
                  <Button variant="outline" className="gap-2">
                    <Truck className="h-4 w-4" />
                    Partner Portal
                  </Button>
                </Link>
              )}
              {sellerProfile && (
                <Link to="/seller">
                  <Button variant="outline" className="gap-2">
                    <Store className="h-4 w-4" />
                    Seller Portal
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Logout Section */}
        <div className="mt-8 pt-6 border-t">
          <Button variant="outline" onClick={handleLogout} className="text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}