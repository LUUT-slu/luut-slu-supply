import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Admin password - in production, use environment variable or secure storage
const ADMIN_PASSWORD = "luut2024";

interface AdminAuthProps {
  children: React.ReactNode;
}

export function AdminAuth({ children }: AdminAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Check if already authenticated in this session
    const auth = sessionStorage.getItem("luut-admin-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const logAdminAction = async (action: string) => {
    try {
      await supabase.from("admin_logs").insert({
        action,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to log admin action:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate small delay for security
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("luut-admin-auth", "true");
      await logAdminAction("admin_login_success");
      toast.success("Welcome, Admin!");
    } else {
      setAttempts((prev) => prev + 1);
      await logAdminAction(`admin_login_failed (attempt ${attempts + 1})`);
      toast.error("Incorrect password");
      
      if (attempts >= 2) {
        toast.error("Too many failed attempts. Please try again later.");
      }
    }

    setIsLoading(false);
    setPassword("");
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("luut-admin-auth");
    await logAdminAction("admin_logout");
    toast.success("Logged out");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter the admin password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || attempts >= 5}
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
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !password || attempts >= 5}
              >
                {isLoading ? "Checking..." : "Enter Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="fixed right-4 top-20 z-50">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout Admin
        </Button>
      </div>
      {children}
    </div>
  );
}
