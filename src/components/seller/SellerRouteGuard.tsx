import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SellerRouteGuardProps {
  children: React.ReactNode;
}

export function SellerRouteGuard({ children }: SellerRouteGuardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkSellerAccess();
  }, []);

  const checkSellerAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/seller-auth", { replace: true });
      return;
    }

    // Check if user has admin role (admins can access seller portal)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const isAdmin = roles?.some(r => (r.role as string) === "admin");

    // Check seller profile
    const { data: profile } = await supabase
      .from("seller_profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    // Admins with approved seller profile can access
    if (isAdmin && profile?.is_approved) {
      setAuthorized(true);
      setLoading(false);
      return;
    }

    // Regular seller flow
    if (!profile) {
      // No seller profile, redirect to apply
      navigate("/seller/apply", { replace: true });
      return;
    }

    if (profile.seller_status === "pending") {
      navigate("/seller/pending", { replace: true });
      return;
    }

    if (profile.seller_status === "rejected" || profile.seller_status === "suspended") {
      navigate("/seller/pending", { replace: true });
      return;
    }

    if (!profile.is_approved) {
      navigate("/seller/pending", { replace: true });
      return;
    }

    setAuthorized(true);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
