import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Store, Eye, EyeOff, ArrowLeft, Mail, KeyRound, Truck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const sellerIdSchema = z.string().regex(/^S[A-Z0-9]{5}$/i, "Seller ID must be like S12ABC");

type AuthMode = "login" | "signup" | "forgot-password" | "seller-id-login";

export default function SellerAuth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user && isMounted) {
        await checkUserRoleAndRedirect(session.user.id, session.user.email);
      }
      
      if (isMounted) {
        setIsCheckingAuth(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only handle SIGNED_IN event to avoid duplicate redirects
      if (event === "SIGNED_IN" && session?.user && isMounted) {
        checkUserRoleAndRedirect(session.user.id, session.user.email);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const checkUserRoleAndRedirect = async (userId: string, userEmail?: string | null) => {
    try {
      // Check for user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      // Check if admin - redirect to admin hub
      const isAdmin = roles?.some(r => (r.role as string) === "admin");
      if (isAdmin) {
        navigate("/admin-hub", { replace: true });
        return;
      }

      // Check for partner role
      const isPartner = roles?.some(r => (r.role as string) === "partner");
      if (isPartner) {
        navigate("/partner", { replace: true });
        return;
      }

      // Check for seller profile
      const { data: sellerProfile } = await supabase
        .from("seller_profiles")
        .select("seller_status, is_approved")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (sellerProfile) {
        navigate("/seller-dashboard", { replace: true });
        return;
      }

      // No specific role - stay on auth page (they might need to sign up as seller)
    } catch (error) {
      console.error("Error checking user role:", error);
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleEmailLogin = async () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check user role and redirect accordingly
      if (data.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        // Check if admin - redirect to admin hub
        const isAdmin = roles?.some(r => (r.role as string) === "admin");
        if (isAdmin) {
          toast.success("Welcome back, Admin!");
          navigate("/admin-hub", { replace: true });
          return;
        }

        const isPartner = roles?.some(r => (r.role as string) === "partner");
        if (isPartner) {
          toast.success("Welcome back, Partner!");
          navigate("/partner", { replace: true });
          return;
        }

        // Check for seller profile
        const { data: sellerProfile } = await supabase
          .from("seller_profiles")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (sellerProfile) {
          toast.success("Welcome back!");
          navigate("/seller-dashboard", { replace: true });
          return;
        }

        // No seller profile - they need to apply
        toast.success("Logged in! Please apply to become a seller.");
        navigate("/register-seller", { replace: true });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    }
  };

  const handleSellerIdLogin = async () => {
    try {
      sellerIdSchema.parse(sellerId.toUpperCase());
      passwordSchema.parse(password);

      // Look up the seller profile to get their email
      const { data: profile, error: profileError } = await supabase
        .from("seller_profiles")
        .select("user_id")
        .eq("seller_id", sellerId.toUpperCase())
        .maybeSingle();

      if (profileError || !profile) {
        toast.error("Seller ID not found");
        return;
      }

      // Get the user's email from auth (we need to use the admin API or store email in profile)
      // For now, we'll inform the user to use their email
      toast.error("Please use your email to login, then find your Seller ID in your dashboard");
      return;
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    }
  };

  const handleSignup = async () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      if (!sellerName.trim()) {
        toast.error("Please enter your store/seller name");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/seller-dashboard`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered. Try logging in.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from("seller_profiles")
          .insert({
            user_id: data.user.id,
            seller_name: sellerName.trim(),
          })
          .select("seller_id")
          .single();

        if (profileError) {
          console.error("Profile creation error:", profileError);
          toast.error("Account created but profile setup failed. Please contact support.");
          return;
        }

        toast.success(`Account created! Your Seller ID is ${profile.seller_id}. Save it!`);
        navigate("/seller-dashboard");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    }
  };

  const handleForgotPassword = async () => {
    try {
      emailSchema.parse(email);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/seller-auth`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password reset link sent! Check your email.");
      setMode("login");
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      switch (mode) {
        case "login":
          await handleEmailLogin();
          break;
        case "signup":
          await handleSignup();
          break;
        case "forgot-password":
          await handleForgotPassword();
          break;
        case "seller-id-login":
          await handleSellerIdLogin();
          break;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setSellerName("");
    setSellerId("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>
              {mode === "login" && "Seller & Partner Portal"}
              {mode === "signup" && "Create Seller Account"}
              {mode === "forgot-password" && "Reset Password"}
              {mode === "seller-id-login" && "Login with Seller ID"}
            </CardTitle>
            <CardDescription>
              {mode === "login" && "Sign in to access your dashboard"}
              {mode === "signup" && "Register to start selling on Luut"}
              {mode === "forgot-password" && "Enter your email to receive a reset link"}
              {mode === "seller-id-login" && "Use your unique Seller ID to sign in"}
            </CardDescription>
            {mode === "login" && (
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Store className="h-3 w-3" /> Sellers</span>
                <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Partners</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Signup: Seller Name */}
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="sellerName">Store/Seller Name</Label>
                  <Input
                    id="sellerName"
                    type="text"
                    placeholder="Your store name"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Seller ID Login */}
              {mode === "seller-id-login" && (
                <div className="space-y-2">
                  <Label htmlFor="sellerId">Seller ID</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="sellerId"
                      type="text"
                      placeholder="S12ABC"
                      value={sellerId}
                      onChange={(e) => setSellerId(e.target.value.toUpperCase())}
                      disabled={isLoading}
                      className="pl-10 uppercase"
                      maxLength={6}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your Seller ID was provided when you registered
                  </p>
                </div>
              )}

              {/* Email field - for login, signup, forgot-password */}
              {(mode === "login" || mode === "signup" || mode === "forgot-password") && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seller@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              {/* Password field - for login, signup, seller-id-login */}
              {(mode === "login" || mode === "signup" || mode === "seller-id-login") && (
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
              )}

              {/* Forgot password link - only on login */}
              {mode === "login" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { resetForm(); setMode("forgot-password"); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Please wait..." : 
                  mode === "login" ? "Sign In" :
                  mode === "signup" ? "Create Account" :
                  mode === "forgot-password" ? "Send Reset Link" :
                  "Sign In with Seller ID"
                }
              </Button>
            </form>

            {/* Mode switching links */}
            <div className="mt-4 space-y-2 text-center">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => { resetForm(); setMode("seller-id-login"); }}
                    className="block w-full text-sm text-primary hover:underline transition-colors"
                  >
                    Login with Seller ID instead
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetForm(); setMode("signup"); }}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Don't have an account? Sign up
                  </button>
                </>
              )}

              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setMode("login"); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Already have an account? Sign in
                </button>
              )}

              {mode === "forgot-password" && (
                <button
                  type="button"
                  onClick={() => { resetForm(); setMode("login"); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to sign in
                </button>
              )}

              {mode === "seller-id-login" && (
                <>
                  <button
                    type="button"
                    onClick={() => { resetForm(); setMode("login"); }}
                    className="block w-full text-sm text-primary hover:underline transition-colors"
                  >
                    Login with email instead
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetForm(); setMode("signup"); }}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Don't have an account? Sign up
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}