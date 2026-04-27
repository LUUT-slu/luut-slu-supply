import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number looks too short")
  .max(20, "Phone number looks too long")
  .regex(/^[+0-9 ()-]+$/, "Only digits, spaces, +, -, ( and ) are allowed");

/**
 * Shows a one-time prompt asking new social-login users for their phone.
 * Reappears each session until phone is filled.
 */
export function PhonePromptModal() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (uid: string) => {
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("phone")
        .eq("user_id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (!profile?.phone) {
        // Skip if dismissed in this browser session
        if (sessionStorage.getItem(`phone_prompt_skipped_${uid}`)) return;
        setUserId(uid);
        setOpen(true);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => check(session.user.id), 500);
      } else {
        setOpen(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) check(session.user.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const save = async () => {
    if (!userId) return;
    const result = phoneSchema.safeParse(phone);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_profiles")
        .update({ phone: result.data })
        .eq("user_id", userId);

      if (error) throw error;

      // Sync to Shopify in the background
      supabase.functions
        .invoke("sync-shopify-customer", { body: { user_id: userId } })
        .catch((e) => console.warn("[shopify-sync] non-blocking error", e));

      toast.success("Phone saved");
      setOpen(false);
    } catch (e) {
      console.error("[phone-prompt] save failed", e);
      toast.error("Could not save your phone. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    if (userId) {
      sessionStorage.setItem(`phone_prompt_skipped_${userId}`, "1");
      await supabase
        .from("customer_profiles")
        .update({ phone_prompt_dismissed_at: new Date().toISOString() })
        .eq("user_id", userId);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? skip() : setOpen(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>One quick thing</DialogTitle>
          <DialogDescription>
            Add your phone so we can reach you about pickups and order updates. Takes 5 seconds.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="phone-prompt-input">Phone number</Label>
          <Input
            id="phone-prompt-input"
            type="tel"
            inputMode="tel"
            placeholder="+1 758 ..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={skip} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={save} disabled={saving || phone.trim().length === 0}>
            {saving ? "Saving…" : "Save phone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
