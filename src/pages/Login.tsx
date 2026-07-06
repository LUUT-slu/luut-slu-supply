import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, ArrowLeft, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

interface RoleAccess {
  hasAdminRole: boolean;
  hasPartnerRole: boolean;
  hasSellerRole: boolean;
  partnerApproved: boolean;
  sellerApproved: boolean;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("login");
  
  // Signup fields
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  const hasCheckedRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextUrl = searchParams.get("next");

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkSessionOnce = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          await handlePostLoginRedirect(session.user.id);
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSessionOnce();
  }, []);

  const checkUserRolesAndApprovals = async (userId: string): Promise<RoleAccess> => {
    // Check user_roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roleNames = roles?.map(r => r.role as string) || [];
    const hasAdminRole = roleNames.includes("admin");
    const hasPartnerRole = roleNames.includes("partner");
    const hasSellerRole = roleNames.includes("seller");

    // Check partner approval
    let partnerApproved = false;
    if (hasPartnerRole) {
      const { data: partnerProfile } = await supabase
        .from("partner_profiles")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();
      
      partnerApproved = partnerProfile?.status === "approved";
    }

    // Check seller approval
    let sellerApproved = false;
    if (hasSellerRole) {
      const { data: sellerProfile } = await supabase
        .from("seller_profiles")
        .select("is_approved")
        .eq("user_id", userId)
        .maybeSingle();
      
      sellerApproved = sellerProfile?.is_approved === true;
    }

    return {
      hasAdminRole,
      hasPartnerRole,
      hasSellerRole,
      partnerApproved,
      sellerApproved,
    };
  };

  const handlePostLoginRedirect = async (userId: string) => {
    const access = await checkUserRolesAndApprovals(userId);

    // If there's a next param, validate access and redirect
    if (nextUrl) {
      if (nextUrl.startsWith("/admin") && access.hasAdminRole) {
        navigate(nextUrl, { replace: true });
        return;
      }
      if (nextUrl.startsWith("/partner") && access.hasPartnerRole && access.partnerApproved) {
        navigate(nextUrl, { replace: true });
        return;
      }
      if (nextUrl.startsWith("/seller") && access.hasSellerRole && access.sellerApproved) {
        navigate(nextUrl, { replace: true });
        return;
      }
      if (nextUrl === "/account") {
        navigate(nextUrl, { replace: true });
        return;
      }
      // If trying to access a portal without approval, show error and fallback
      if (nextUrl.startsWith("/partner") && (!access.hasPartnerRole || !access.partnerApproved)) {
        toast.error("No partner access. Contact admin for approval.");
      }
      if (nextUrl.startsWith("/seller") && (!access.hasSellerRole || !access.sellerApproved)) {
        // Will be handled by RouteGuard - let it redirect to apply page
      }
    }

    // Priority-based redirect (no next param or invalid access)
    if (access.hasAdminRole) {
      navigate("/admin", { replace: true });
      return;
    }
    if (access.hasPartnerRole && access.partnerApproved) {
      navigate("/partner", { replace: true });
      return;
    }
    if (access.hasSellerRole && access.sellerApproved) {
      navigate("/seller", { replace: true });
      return;
    }

    // Default to account page
    navigate("/account", { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
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
        await handlePostLoginRedirect(data.user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupPassword || !signupConfirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (signupPassword !== signupConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }

    setIsLoading(true);
    
    const redirectUrl = `${window.location.origin}/account`;
    
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Account created! You can now sign in.");
      setActiveTab("login");
      setEmail(signupEmail);
      
      // Fire-and-forget welcome email
      supabase.functions.invoke("send-welcome-email", {
        body: { userId: null, email: signupEmail },
      }).catch(() => {});

      // Fire-and-forget admin alert: new customer signup
      supabase.functions.invoke("send-admin-alert", {
        body: {
          type: "customer_signup",
          payload: { email: signupEmail, full_name: fullName || null },
        },
      }).catch(() => {});
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/account`,
    });
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
    }
    
    setIsLoading(false);
  };

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

  if (showForgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForgotPassword(false)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Button>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">Reset Password</CardTitle>
              <CardDescription>
                Enter your email and we'll send you a reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </CardContent>
          </Card>
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
              <User className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-display text-xl">Welcome to Luut</CardTitle>
            <CardDescription>Sign in or create an account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6 space-y-4">
                <GoogleSignInButton nextUrl={nextUrl} />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or with email</span>
                  </div>
                </div>
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
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="pl-10 pr-10"
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

                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </button>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <GoogleSignInButton nextUrl={nextUrl} label="Sign up with Google" />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or with email</span>
                  </div>
                </div>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name (optional)</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="full-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10 pr-10"
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

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Portal Links */}
            <div className="mt-6 pt-4 border-t space-y-2">
              <p className="text-xs text-center text-muted-foreground">Business Portals</p>
              <div className="flex gap-2 justify-center">
                <Link 
                  to="/login?next=/partner" 
                  className="text-xs text-primary hover:underline"
                >
                  Partner Portal
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link 
                  to="/login?next=/seller" 
                  className="text-xs text-primary hover:underline"
                >
                  Seller Portal
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
