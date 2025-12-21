import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function Auth() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndProfiles = async (userId: string) => {
      // Check for seller profile
      const { data: seller } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      setSellerProfile(seller);

      // Check for customer profile
      const { data: customer } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      
      setCustomerProfile(customer);
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          checkAuthAndProfiles(session.user.id);
        }, 0);
      } else {
        setSellerProfile(null);
        setCustomerProfile(null);
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) {
        checkAuthAndProfiles(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // If logged in with profiles, show account options
  if (currentUser && !isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container py-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="mx-auto max-w-md space-y-4">
            <h1 className="font-display text-2xl text-center mb-6">My Accounts</h1>
            
            {/* Customer Account */}
            <Link to="/account" className="block">
              <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg">Customer Account</h3>
                    <p className="text-sm text-muted-foreground">
                      {customerProfile ? "View & manage your profile" : "Set up your customer profile"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Seller Account */}
            <Link to={sellerProfile ? "/seller-dashboard" : "/seller-auth"} className="block">
              <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                    <Store className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg">Seller Account</h3>
                    <p className="text-sm text-muted-foreground">
                      {sellerProfile ? "Go to your seller dashboard" : "Register as a seller"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Sign Out */}
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/");
              }}
            >
              Sign Out
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not logged in - show sign in options
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="mx-auto max-w-md space-y-4">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl mb-2">Welcome</h1>
            <p className="text-muted-foreground">Choose how you'd like to continue</p>
          </div>

          {/* Sign in as Customer */}
          <Link to="/customer-auth" className="block">
            <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg">Sign in as Customer</h3>
                  <p className="text-sm text-muted-foreground">
                    Shop, track orders & manage preferences
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Sign in as Seller */}
          <Link to="/seller-auth" className="block">
            <Card className="transition-all hover:border-primary hover:shadow-md active:scale-[0.98]">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <Store className="h-7 w-7 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg">Sign in as Seller</h3>
                  <p className="text-sm text-muted-foreground">
                    Access your seller dashboard & products
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
