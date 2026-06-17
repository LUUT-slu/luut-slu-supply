import { useState } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

interface Props {
  nextUrl?: string | null;
  label?: string;
  className?: string;
}

export function GoogleSignInButton({ nextUrl, label = "Continue with Google", className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const redirectUri = nextUrl
        ? `${window.location.origin}${nextUrl.startsWith("/") ? "" : "/"}${nextUrl}`
        : window.location.origin;

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectUri,
      });

      if (result.error) {
        console.error("[google-signin]", result.error);
        toast.error("Could not start Google sign-in. Please try again.");
        setLoading(false);
        return;
      }

      if (result.redirected) {
        // Browser will redirect to Google
        return;
      }

      // Tokens received and session set — navigate to next
      window.location.href = redirectUri;
    } catch (err) {
      console.error("[google-signin]", err);
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
    }
  };


  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className={`w-full h-11 gap-3 bg-white text-foreground border-border hover:bg-muted/50 ${className ?? ""}`}
    >
      <GoogleIcon />
      <span className="font-medium">{loading ? "Connecting…" : label}</span>
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
