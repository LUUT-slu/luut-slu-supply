import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/account";

  useEffect(() => {
    const finish = async () => {
      // Give the lovable client a tick to set the session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/login", { replace: true });
        return;
      }

      // If Google returned a refresh token (calendar scope was granted), store it
      // server-side immediately. Fire-and-forget — never blocks navigation.
      if (session.provider_refresh_token) {
        supabase.functions
          .invoke("store-calendar-token", {
            body: { refresh_token: session.provider_refresh_token },
          })
          .catch((e) => console.warn("[calendar-token] store failed (non-blocking)", e));
      }

      // Small delay to let useEnsureCustomerProfile handle the upsert
      setTimeout(() => navigate(next, { replace: true }), 250);
    };
    finish();
  }, [navigate, next]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Finishing sign-in…</p>
      </div>
    </div>
  );
}
