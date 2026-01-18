import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Home, LogOut, Store } from "lucide-react";
import { toast } from "sonner";

export default function SellerPending() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="container flex-1 py-8">
        <div className="mx-auto max-w-lg">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl">Application Pending</CardTitle>
              <CardDescription className="text-base">
                Your seller application is being reviewed by our team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <p className="mb-2">
                  <strong>What happens next?</strong>
                </p>
                <ul className="list-inside list-disc space-y-1 text-left">
                  <li>Our team will review your application within 24-48 hours</li>
                  <li>You'll receive an email once your account is approved</li>
                  <li>After approval, you can start listing your products</li>
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
                  <Home className="h-4 w-4" />
                  Back to Home
                </Button>
                <Button onClick={handleLogout} variant="ghost" className="gap-2 text-muted-foreground">
                  <LogOut className="h-4 w-4" />
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
