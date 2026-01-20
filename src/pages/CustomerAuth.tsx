import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Legacy page - redirects to unified login
export default function CustomerAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
