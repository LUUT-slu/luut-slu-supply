import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Store, Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function SellerAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const hasCheckedRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only check once
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkSessionOnce = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await redirectBasedOnRole(session.user.id);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSessionOnce();
  }, []);

  const redirectBasedOnRole = async (userId: string) => {
    // Check for admin role first
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = roles?.some(r => (r.role as string) === "admin");
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }

    // Check for partner role
    const isPartner = roles?.some(r => (r.role as string) === "partner");
    if (isPartner) {
      navigate("/partner", { replace: true });
      return;
    }

    // Check seller profile
    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("is_approved, seller_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (sellerProfile) {
      if (sellerProfile.is_approved) {
        navigate("/seller", { replace: true });
      } else {
        navigate("/seller/pending", { replace: true });
      }
      return;
    }

    // No seller profile - go to registration
    navigate("/register-seller", { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message.includes("Invalid login") 
          ? "Invalid email or password" 
          : error.message);
        return;
      }

      if (data.user) {
        toast.success("Welcome back!");
        await redirectBasedOnRole(data.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading only during initial auth check
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Seller Portal</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <span>Don't have an account? </span>
              <button
                type="button"
                onClick={() => navigate("/register-seller")}
                className="text-primary hover:underline"
              >
                Register as Seller
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
