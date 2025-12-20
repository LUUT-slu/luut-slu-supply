import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface AdminAuthProps {
  children: React.ReactNode;
}

// This component now redirects to the new seller authentication system
export function AdminAuth({ children }: AdminAuthProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the new seller auth page
    navigate("/seller-auth", { replace: true });
  }, [navigate]);

  return null;
}