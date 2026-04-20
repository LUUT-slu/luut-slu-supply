import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
}

interface Discount {
  id: string;
  discount_type: string;
  discount_amount: number;
  currency_code: string;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
}

export function CustomerDiscountsPanel({ userId }: Props) {
  const qc = useQueryClient();
  const [type, setType] = useState("manual");
  const [amount, setAmount] = useState("5");

  const { data: discounts = [] } = useQuery({
    queryKey: ["admin-customer-discounts", userId],
    queryFn: async (): Promise<Discount[]> => {
      const { data } = await supabase
        .from("customer_discounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const grant = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    const { error } = await supabase.from("customer_discounts").insert({
      user_id: userId,
      discount_type: type,
      discount_amount: amt,
      currency_code: "XCD",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts", userId] });
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
    qc.invalidateQueries({ queryKey: ["admin-customer-detail", userId] });
    toast.success("Discount granted");
  };

  const revoke = async (id: string) => {
    await supabase.from("customer_discounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-customer-discounts", userId] });
    qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Grant a discount</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Input value={type} onChange={(e) => setType(e.target.value)} className="h-10" />
            </div>
            <div>
              <Label className="text-xs">Amount (EC$)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <Button onClick={grant} className="w-full h-10">
            Grant discount
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">All discounts</h3>
        {discounts.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No discounts yet.</p>
        )}
        {discounts.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-md border border-border bg-card p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm capitalize">{d.discount_type}</span>
                <Badge variant={d.is_used ? "secondary" : "default"} className="text-[10px] h-5">
                  {d.is_used ? "Used" : "Active"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {d.currency_code} {Number(d.discount_amount).toFixed(2)} ·{" "}
                {format(new Date(d.created_at), "MMM d, yyyy")}
              </div>
            </div>
            {!d.is_used && (
              <button onClick={() => revoke(d.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
