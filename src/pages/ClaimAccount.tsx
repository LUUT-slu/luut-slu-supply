import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, ShieldAlert, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { phoneInputProps } from "@/lib/text";

export default function ClaimAccount() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [locked, setLocked] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, skip to account
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/account", { replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("verify-claim", {
        body: { token, phone },
      });
      if (fnErr || !data) {
        // supabase.functions.invoke wraps non-2xx as errors; try to parse
        const msg =
          (fnErr as any)?.context?.error ||
          (fnErr as any)?.message ||
          "Something went wrong. Try again.";
        setError(typeof msg === "string" ? msg : "Something went wrong.");
        return;
      }
      if ((data as any).error) {
        setError((data as any).error);
        if ((data as any).locked_until) setLocked((data as any).locked_until);
        if (typeof (data as any).attempts_left === "number") setAttemptsLeft((data as any).attempts_left);
        return;
      }
      const session = (data as any).session;
      if (session?.access_token && session?.refresh_token) {
        const { error: sErr } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (sErr) throw sErr;
        setSuccess(true);
        toast.success("Account claimed! Redirecting…");
        setTimeout(() => navigate("/account", { replace: true }), 1200);
      } else {
        setError("Session could not be started. Try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = () => {
    window.open(
      "https://wa.me/17587280708?text=" + encodeURIComponent("Hi Luut, I need help claiming my account."),
      "_blank",
    );
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p>Invalid claim link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {success ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <ShieldAlert className="w-5 h-5" />}
            {success ? "Account claimed" : "Claim your account"}
          </CardTitle>
          <CardDescription>
            {success
              ? "Taking you to your dashboard…"
              : "Enter the phone number you used on your orders to unlock your history, discounts, and faster checkout."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!success && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Phone number</label>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  placeholder="758 XXX XXXX"
                  {...phoneInputProps(phone, setPhone)}
                  disabled={submitting || !!locked}
                />

              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-3 rounded-md">
                  {error}
                  {attemptsLeft !== null && attemptsLeft > 0 && !locked && (
                    <div className="text-xs mt-1 opacity-80">{attemptsLeft} attempts left before this link is locked.</div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting || !!locked || !phone.trim()}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {locked ? "Link locked — try later" : "Claim my account"}
              </Button>

              <button
                type="button"
                onClick={openWhatsApp}
                className="w-full text-sm text-muted-foreground flex items-center justify-center gap-2 hover:text-foreground"
              >
                <MessageCircle className="w-4 h-4" />
                Need help? Message Luut on WhatsApp
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
