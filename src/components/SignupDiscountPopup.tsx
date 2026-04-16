import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "signup-popup-dismissed";

export function SignupDiscountPopup() {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) setOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoggedIn !== false) return;

    // Don't show if dismissed this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const timer = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem(STORAGE_KEY, "1");
  };

  const handleSignup = () => {
    handleClose();
    navigate("/auth");
  };

  if (isLoggedIn !== false) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm border-primary/30 p-0 sm:max-w-md [&>button]:hidden">
        <div className="relative flex flex-col items-center px-6 pb-8 pt-10 text-center">
          <button
            onClick={handleClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mb-2 font-display text-2xl tracking-tight sm:text-3xl">
            GET EC$10 OFF
          </h2>
          <p className="mb-1 text-sm font-medium text-primary">
            Your first order — on us
          </p>
          <p className="mb-6 text-sm text-muted-foreground max-w-[280px]">
            Create a free account and get EC$10 off storewide. One-time offer for new customers only.
          </p>

          <div className="flex w-full flex-col gap-3">
            <Button
              onClick={handleSignup}
              className="w-full font-bold text-base py-6"
              size="lg"
            >
              Create Account — Claim EC$10 Off
            </Button>
            <button
              onClick={() => {
                handleClose();
                navigate("/auth");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
