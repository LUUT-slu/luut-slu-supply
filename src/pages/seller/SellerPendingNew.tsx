import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { Clock, XCircle, Ban, Home, LogOut } from "lucide-react";

interface SellerProfile {
  seller_name: string;
  seller_status: string | null;
  location: string | null;
  phone: string | null;
  created_at: string;
}

export default function SellerPendingNew() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }

    const { data: profileData } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!profileData) {
      navigate("/seller/apply", { replace: true });
      return;
    }

    if (profileData.is_approved && profileData.seller_status === "approved") {
      navigate("/seller/dashboard", { replace: true });
      return;
    }

    setProfile(profileData as unknown as SellerProfile);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getStatusConfig = () => {
    switch (profile?.seller_status) {
      case "rejected":
        return {
          icon: XCircle,
          iconColor: "text-destructive",
          bgColor: "bg-destructive/10",
          badge: <Badge variant="destructive">Rejected</Badge>,
          title: "Application Rejected",
          description: "Unfortunately, your application was not approved. Please contact support for more information.",
        };
      case "suspended":
        return {
          icon: Ban,
          iconColor: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          badge: <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Suspended</Badge>,
          title: "Account Suspended",
          description: "Your seller account has been suspended. Please contact support to resolve this issue.",
        };
      default:
        return {
          icon: Clock,
          iconColor: "text-blue-500",
          bgColor: "bg-blue-500/10",
          badge: <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Under Review</Badge>,
          title: "Application Pending",
          description: "Your application is being reviewed by our team. This usually takes 24-48 hours.",
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="container flex-1 py-6">
        <BackButton to="/" />
        
        <div className="mx-auto max-w-md">
          <Card className="border-border/60">
            <CardHeader className="text-center">
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${statusConfig.bgColor}`}>
                <statusConfig.icon className={`h-7 w-7 ${statusConfig.iconColor}`} />
              </div>
              <div className="flex justify-center mb-2">
                {statusConfig.badge}
              </div>
              <CardTitle className="text-xl">{statusConfig.title}</CardTitle>
              <CardDescription>
                {statusConfig.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Application Details */}
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shop Name</span>
                  <span className="font-medium">{profile?.seller_name}</span>
                </div>
                {profile?.location && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Location</span>
                    <span>{profile.location}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Applied</span>
                  <span>{new Date(profile?.created_at || "").toLocaleDateString()}</span>
                </div>
              </div>

              {/* Next Steps */}
              {profile?.seller_status === "pending" && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="font-medium text-sm mb-2">What happens next?</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Our team reviews your application</li>
                    <li>• You'll receive a notification when approved</li>
                    <li>• Once approved, you can start adding products</li>
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Return Home
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full text-muted-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
