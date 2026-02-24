import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldX, Store, ArrowLeft } from "lucide-react";

export type RequiredRole = "admin" | "partner" | "seller" | "authenticated";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole: RequiredRole;
  /** If set, show "Apply" page instead of redirect when access is denied for seller role */
  showApplyPage?: string;
}

interface AccessCheck {
  isAuthenticated: boolean;
  hasAccess: boolean;
  reason?: string;
}

export function RouteGuard({ children, requiredRole, showApplyPage }: RouteGuardProps) {
  const [loading, setLoading] = useState(true);
  const [accessCheck, setAccessCheck] = useState<AccessCheck>({
    isAuthenticated: false,
    hasAccess: false,
  });
  const hasCheckedRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          // Not logged in - redirect to login with next param
          const nextPath = encodeURIComponent(location.pathname);
          navigate(`/login?next=${nextPath}`, { replace: true });
          return;
        }

        const userId = session.user.id;

        // If only authenticated is required, grant access
        if (requiredRole === "authenticated") {
          setAccessCheck({ isAuthenticated: true, hasAccess: true });
          setLoading(false);
          return;
        }

        // Check user_roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        const roleNames = roles?.map(r => r.role as string) || [];
        const isAdmin = roleNames.includes("admin");

        // Admins have access to ALL roles - bypass all checks
        if (isAdmin) {
          setAccessCheck({ isAuthenticated: true, hasAccess: true });
          setLoading(false);
          return;
        }

        // Admin check (for non-admins trying to access admin routes)
        if (requiredRole === "admin") {
          toast.error("Admin access required");
          navigate("/", { replace: true });
          return;
        }

        // Partner check - requires role + approved status
        if (requiredRole === "partner") {
          if (!roleNames.includes("partner")) {
            toast.error("No partner access. Contact admin.");
            navigate("/", { replace: true });
            return;
          }

          const { data: partnerProfile } = await supabase
            .from("partner_profiles")
            .select("status")
            .eq("user_id", userId)
            .maybeSingle();

          if (partnerProfile?.status === "approved") {
            setAccessCheck({ isAuthenticated: true, hasAccess: true });
          } else {
            toast.error("Partner access pending approval. Contact admin.");
            navigate("/", { replace: true });
            return;
          }
          setLoading(false);
          return;
        }

        // Seller check - requires approved seller_profiles entry
        if (requiredRole === "seller") {
          const { data: sellerProfile } = await supabase
            .from("seller_profiles")
            .select("is_approved, seller_status")
            .eq("user_id", userId)
            .maybeSingle();

          if (sellerProfile?.is_approved) {
            setAccessCheck({ isAuthenticated: true, hasAccess: true });
          } else {
            setAccessCheck({
              isAuthenticated: true,
              hasAccess: false,
              reason: sellerProfile ? "pending_approval" : "no_profile",
            });
          }
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error("RouteGuard error:", error);
        navigate("/login", { replace: true });
      }
    };

    checkAccess();
  }, [requiredRole, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // Show access denied UI for seller if showApplyPage is set
  if (!accessCheck.hasAccess && requiredRole === "seller" && showApplyPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                <Store className="h-8 w-8 text-amber-600" />
              </div>
              <CardTitle className="font-display text-xl">Seller Access Required</CardTitle>
              <CardDescription>
                {accessCheck.reason === "no_role" && "You don't have seller access yet."}
                {accessCheck.reason === "no_profile" && "You haven't applied to become a seller."}
                {accessCheck.reason === "pending_approval" && "Your seller application is pending approval."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accessCheck.reason === "pending_approval" ? (
                <p className="text-sm text-muted-foreground">
                  Please wait while we review your application. You'll be notified once approved.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Want to sell on Luut? Apply to become a seller and start reaching customers in Saint Lucia.
                  </p>
                  <Button 
                    onClick={() => navigate(showApplyPage)} 
                    className="w-full"
                  >
                    Apply to Sell
                  </Button>
                </>
              )}

              <Button 
                variant="outline" 
                onClick={() => navigate("/account")}
                className="w-full"
              >
                Go to My Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If no access and not handled above, this shouldn't happen but handle gracefully
  if (!accessCheck.hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
