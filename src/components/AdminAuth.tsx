import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AdminAuthProps {
  children: React.ReactNode;
}

// This component checks if the user has admin role in the database
export function AdminAuth({ children }: AdminAuthProps) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/seller-auth", { replace: true });
        return;
      }

      // Check if user has admin role
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (error || !roles) {
        // Not an admin, redirect
        navigate("/seller-auth", { replace: true });
        return;
      }

      setIsAdmin(true);
    };

    checkAdminRole();
  }, [navigate]);

  if (isAdmin === null) {
    // Loading state
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
