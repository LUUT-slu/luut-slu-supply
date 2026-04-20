import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Copy, Share2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  customerName: string | null;
  customerPhone: string | null;
}

interface Referral {
  id: string;
  referral_code: string;
  referred_user_id: string | null;
  referred_email: string | null;
  status: string;
  reward_granted: boolean;
  created_at: string;
}

const generateCode = (name: string | null) => {
  const base = (name || "luut").toLowerCase().replace(/[^a-z]/g, "").slice(0, 6) || "luut";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base.toUpperCase()}${suffix}`;
};

export function CustomerReferralsPanel({ userId, customerName, customerPhone }: Props) {
  const qc = useQueryClient();

  const { data: referrals = [] } = useQuery({
    queryKey: ["admin-customer-referrals", userId],
    queryFn: async (): Promise<Referral[]> => {
      const { data } = await supabase
        .from("customer_referrals")
        .select("*")
        .eq("referrer_user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createCode = async () => {
    const code = generateCode(customerName);
    const { error } = await supabase.from("customer_referrals").insert({
      referrer_user_id: userId,
      referral_code: code,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-customer-referrals", userId] });
    toast.success(`Code ${code} created`);
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  const shareViaWhatsApp = (code: string) => {
    if (!customerPhone) {
      toast.error("No phone on file");
      return;
    }
    const firstName = customerName?.split(" ")[0] || "there";
    const text = `Hey ${firstName}, here's your LUUT referral code: ${code}. Share it with a friend and you'll both get a discount!`;
    const phone = customerPhone.replace(/[^\d+]/g, "").replace(/^\+/, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const markRewarded = async (id: string) => {
    await supabase
      .from("customer_referrals")
      .update({ reward_granted: true, status: "rewarded", rewarded_at: new Date().toISOString() })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-customer-referrals", userId] });
  };

  return (
    <div className="space-y-3">
      <Button onClick={createCode} className="w-full h-10 gap-2">
        <Plus className="h-4 w-4" /> Generate referral code
      </Button>

      <div className="space-y-2">
        {referrals.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No referral codes yet.</p>
        )}
        {referrals.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="font-mono">{r.referral_code}</span>
                <Badge
                  variant={r.status === "rewarded" ? "default" : r.status === "signed_up" ? "secondary" : "outline"}
                  className="text-[10px] h-5 capitalize"
                >
                  {r.status.replace("_", " ")}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="text-xs text-muted-foreground">
                Created {format(new Date(r.created_at), "MMM d, yyyy")}
                {r.referred_email && ` · Referred ${r.referred_email}`}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(r.referral_code)} className="h-9 gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => shareViaWhatsApp(r.referral_code)}
                  className="h-9 gap-1.5"
                  disabled={!customerPhone}
                >
                  <Share2 className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                {!r.reward_granted && (
                  <Button size="sm" variant="default" onClick={() => markRewarded(r.id)} className="h-9 ml-auto">
                    Mark rewarded
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
