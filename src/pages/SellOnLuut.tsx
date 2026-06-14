import { useState } from "react";
import { SEO } from "@/components/SEO";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort", "Rodney Bay", "Soufriere", "Other"];

export default function SellOnLuut() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    businessName: "",
    location: "",
    instagram: "",
    facebook: "",
    secondaryPhone: "",
    email: "",
    tiktok: "",
  });

  const handleOpen = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/login?next=/sell");
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      navigate("/login?next=/sell");
      return;
    }

    setLoading(true);
    try {
      // Check for existing application
      const { data: existing } = await supabase
        .from("seller_applications")
        .select("id, status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === "pending") {
          toast.info("You already have a pending application.");
        } else if (existing.status === "approved") {
          toast.info("You're already approved! Redirecting...");
          navigate("/seller/dashboard");
        } else {
          toast.error("Your previous application was " + existing.status + ". Contact support for assistance.");
        }
        setLoading(false);
        setOpen(false);
        return;
      }

      const { error } = await supabase.from("seller_applications").insert({
        user_id: session.user.id,
        name: formData.fullName,
        whatsapp: formData.phone,
        business_name: formData.businessName,
        location: formData.location,
        instagram_url: formData.instagram,
        facebook_url: formData.facebook || null,
        secondary_phone: formData.secondaryPhone || null,
        email: formData.email || null,
        tiktok_url: formData.tiktok || null,
      });

      if (error) throw error;

      // Fire-and-forget admin alert: new seller application
      supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "seller_application",
          payload: {
            name: formData.fullName,
            business_name: formData.businessName,
            whatsapp: formData.phone,
            location: formData.location,
            instagram_url: formData.instagram,
            email: formData.email || null,
          },
        },
      }).catch(() => {});

      toast.success("Application submitted! We'll review it shortly.");
      setOpen(false);
      setFormData({
        fullName: "", phone: "", businessName: "", location: "",
        instagram: "", facebook: "", secondaryPhone: "", email: "", tiktok: "",
      });
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SEO title="Sell on Luut SLU — Apply as a Seller" description="Apply to sell on Luut SLU. Reach Saint Lucia shoppers, keep your own brand, fulfill orders directly on meetup." path="/sell" />
      <Header />

      <main className="flex-1">
        <section className="px-4 py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-2xl">
              <BackButton />
              {/* WHERE BRANDS GROW */}
              <div className="mb-16 text-center">
                <h1 className="mb-8 font-display text-4xl md:text-5xl">
                  WHERE BRANDS <span className="text-primary">GROW</span>
                </h1>

                <div className="space-y-4 font-body text-muted-foreground">
                  <p className="text-lg">
                    This space is built for local creators, resellers, and brand builders who want to grow.
                  </p>
                  <p>
                    You keep your own identity, your own pages, and your own way of selling.
                    The platform exists to make growth simpler — helping customers discover your products and connect with you faster, especially through WhatsApp.
                  </p>
                </div>
              </div>

              {/* HOW IT WORKS */}
              <div className="mb-16">
                <h2 className="mb-6 text-center font-display text-2xl md:text-3xl">
                  HOW IT WORKS
                </h2>

                <div className="rounded-lg border border-border bg-card p-6">
                  <ul className="space-y-4 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">1</span>
                      <span className="font-body text-muted-foreground">Your products are listed on the platform</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">2</span>
                      <span className="font-body text-muted-foreground">Platform ads drive traffic directly to your product page</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">3</span>
                      <span className="font-body text-muted-foreground">Customers click and message you on WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-display text-xs text-primary-foreground">4</span>
                      <span className="font-body text-muted-foreground">You handle the conversation, meetup, and sale</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 space-y-3 text-center font-body text-sm text-muted-foreground">
                  <p>
                    You're still free to promote your products on your own pages — share your link, repost your listings, or run ads to your page on the platform.
                  </p>
                  <p>
                    A small platform commission supports ads, visibility, and operations. Full details are shared during onboarding.
                  </p>
                </div>
              </div>

              {/* REQUIREMENTS */}
              <div className="mb-16">
                <h2 className="mb-6 text-center font-display text-2xl md:text-3xl">
                  REQUIREMENTS
                </h2>

                <div className="rounded-lg border border-border bg-card p-6">
                  <ul className="space-y-3 font-body text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Based in Saint Lucia</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Able to meet customers (Castries, Gros Islet, Rodney Bay, or your own set location)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Active Instagram page</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>WhatsApp Business account (business only — no personal WhatsApp)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Clear product photos customers can easily understand</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Facebook page (optional)</span>
                    </li>
                  </ul>

                  <p className="mt-6 border-t border-border pt-4 font-body text-xs text-muted-foreground">
                    If you offer delivery, clearly state your delivery areas and cost.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button size="lg" onClick={handleOpen}>
                  Apply to Sell
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Application Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Seller Application</DialogTitle>
            <DialogDescription>
              Fill in your details to apply. All fields marked * are required.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mandatory fields */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="758-xxx-xxxx"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder="Your brand or business name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Location *</Label>
              <Select
                value={formData.location}
                onValueChange={(v) => update("location", v)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your area" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram">Business Instagram Link *</Label>
              <Input
                id="instagram"
                value={formData.instagram}
                onChange={(e) => update("instagram", e.target.value)}
                placeholder="https://instagram.com/yourbusiness"
                required
              />
            </div>

            {/* Optional fields */}
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">OPTIONAL</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook">Facebook Link</Label>
                  <Input
                    id="facebook"
                    value={formData.facebook}
                    onChange={(e) => update("facebook", e.target.value)}
                    placeholder="https://facebook.com/yourbusiness"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryPhone">Secondary Phone Number</Label>
                  <Input
                    id="secondaryPhone"
                    type="tel"
                    value={formData.secondaryPhone}
                    onChange={(e) => update("secondaryPhone", e.target.value)}
                    placeholder="758-xxx-xxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok Link</Label>
                  <Input
                    id="tiktok"
                    value={formData.tiktok}
                    onChange={(e) => update("tiktok", e.target.value)}
                    placeholder="https://tiktok.com/@yourbusiness"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !formData.location}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
