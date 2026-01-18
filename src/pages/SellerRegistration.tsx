import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Store, Phone, MapPin, MessageCircle, Link as LinkIcon, Tags } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export default function SellerRegistration() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [existingApplication, setExistingApplication] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    location: "",
    description: "",
    categories: "",
    proofUrl: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkExistingApplication(session.user.id);
      }
    });
  }, []);

  const checkExistingApplication = async (userId: string) => {
    const { data } = await supabase
      .from("seller_applications")
      .select("status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setExistingApplication(data.status);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Please enter your name or business name");
      return;
    }
    
    if (!formData.whatsapp.trim()) {
      toast.error("WhatsApp number is required");
      return;
    }

    // Check if user is logged in
    if (!user) {
      toast.error("Please sign in first to apply as a seller");
      navigate("/auth");
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse categories from comma-separated string
      const categoriesArray = formData.categories
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const { error } = await supabase.from("seller_applications").insert({
        user_id: user.id,
        name: formData.name.trim(),
        whatsapp: formData.whatsapp.trim(),
        location: formData.location.trim() || null,
        categories: categoriesArray.length > 0 ? categoriesArray : null,
        proof_url: formData.proofUrl.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      // Also create a pending seller profile if one doesn't exist
      const { data: existingProfile } = await supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        const sellerId = `S${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        await supabase.from("seller_profiles").insert({
          user_id: user.id,
          seller_name: formData.name.trim(),
          seller_id: sellerId,
          whatsapp: formData.whatsapp.trim(),
          location: formData.location.trim() || null,
          is_approved: false,
          seller_status: "pending",
        });
      }

      setIsSubmitted(true);
      toast.success("Application submitted!");
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show existing application status
  if (existingApplication && !isSubmitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex flex-1 flex-col items-center justify-center py-16">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Application {existingApplication === "pending" ? "Pending" : existingApplication === "approved" ? "Approved" : "Status"}</CardTitle>
              <CardDescription>
                {existingApplication === "pending" && "Your seller application is being reviewed. We'll contact you via WhatsApp within 24-48 hours."}
                {existingApplication === "approved" && "You're already an approved seller!"}
                {existingApplication === "rejected" && "Your previous application was rejected. You may apply again with updated information."}
                {existingApplication === "banned" && "Your account has been banned from selling on this platform."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {existingApplication === "approved" && (
                <Button onClick={() => navigate("/seller-dashboard")} className="w-full">
                  Go to Dashboard
                </Button>
              )}
              {existingApplication === "rejected" && (
                <Button onClick={() => { setExistingApplication(null); }} className="w-full">
                  Submit New Application
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex flex-1 flex-col items-center justify-center py-16">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Application Submitted!</CardTitle>
              <CardDescription>
                Thank you for your interest in selling on Luut. We'll review your application and contact you via WhatsApp within 24-48 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once approved, you'll receive seller access to list your products and manage orders.
              </p>
              <Button onClick={() => navigate("/")} className="w-full">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Check if user is logged in
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="container flex flex-1 flex-col items-center justify-center py-16">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Sign In Required</CardTitle>
              <CardDescription>
                Please sign in or create an account to apply as a seller on Luut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => navigate("/auth")} className="w-full">
                Sign In / Sign Up
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-8">
        <div className="mx-auto max-w-lg">
          <div className="mb-6">
            <BackButton />
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Become a Seller</CardTitle>
              <CardDescription>
                Join Luut's network of verified sellers in Saint Lucia. Fill out the form below to apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Name / Business Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name or business name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp Number *
                  </Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    placeholder="17587XXXXXX"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g., Castries, Gros Islet"
                  />
                </div>

                <div>
                  <Label htmlFor="categories" className="flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Categories (comma-separated)
                  </Label>
                  <Input
                    id="categories"
                    name="categories"
                    value={formData.categories}
                    onChange={handleChange}
                    placeholder="e.g., Clothing, Shoes, Accessories"
                  />
                </div>

                <div>
                  <Label htmlFor="proofUrl" className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Instagram / Portfolio Link (optional)
                  </Label>
                  <Input
                    id="proofUrl"
                    name="proofUrl"
                    value={formData.proofUrl}
                    onChange={handleChange}
                    placeholder="https://instagram.com/your-page"
                  />
                </div>

                <div>
                  <Label htmlFor="description">
                    Tell us about yourself / what you sell
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="What products do you sell? Any experience selling online?"
                    rows={4}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  By submitting, you agree to our seller terms. We'll review your application and contact you via WhatsApp.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
