import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminOperations } from "@/hooks/usePartnerOperations";
import { Loader2 } from "lucide-react";

interface Partner {
  user_id: string;
  partner_name: string;
  phone: string | null;
  whatsapp: string | null;
  is_active: boolean;
}

interface AssignOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: number;
  orderTotal: number;
  currencyCode: string;
  partners: Partner[];
  onAssigned: (partnerId: string, commissionType: 'fixed' | 'percent', commissionValue: number) => void;
}

export function AssignOrderModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  orderTotal,
  currencyCode,
  partners,
  onAssigned,
}: AssignOrderModalProps) {
  const { assignOrder } = useAdminOperations();
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [commissionType, setCommissionType] = useState<'fixed' | 'percent'>('fixed');
  const [commissionValue, setCommissionValue] = useState<string>("10");
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPartner("");
      setCommissionType('fixed');
      setCommissionValue("10");
    }
  }, [open]);

  const calculatedCommission = commissionType === 'fixed' 
    ? parseFloat(commissionValue) || 0
    : (orderTotal * (parseFloat(commissionValue) || 0)) / 100;

  const adminReceives = orderTotal - calculatedCommission;

  const handleAssign = async () => {
    if (!selectedPartner || !commissionValue) return;
    
    setLoading(true);
    const success = await assignOrder(
      orderId,
      selectedPartner,
      commissionType,
      parseFloat(commissionValue)
    );
    setLoading(false);

    if (success) {
      onAssigned(selectedPartner, commissionType, parseFloat(commissionValue));
      onOpenChange(false);
    }
  };

  const formatOrderNumber = (num: number) => `#L${String(num).padStart(4, '0')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Order {formatOrderNumber(orderNumber)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Total */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">Order Total</p>
            <p className="text-xl font-bold">{currencyCode}${orderTotal.toFixed(2)}</p>
          </div>

          {/* Partner Selection */}
          <div className="space-y-2">
            <Label>Assign to Partner</Label>
            <Select value={selectedPartner} onValueChange={setSelectedPartner}>
              <SelectTrigger>
                <SelectValue placeholder="Select a partner..." />
              </SelectTrigger>
              <SelectContent>
                {partners.map((partner) => (
                  <SelectItem key={partner.user_id} value={partner.user_id}>
                    {partner.partner_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Commission Type */}
          <div className="space-y-2">
            <Label>Commission Type</Label>
            <RadioGroup
              value={commissionType}
              onValueChange={(v) => setCommissionType(v as 'fixed' | 'percent')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixed" id="fixed" />
                <Label htmlFor="fixed" className="cursor-pointer">Fixed ({currencyCode}$)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percent" id="percent" />
                <Label htmlFor="percent" className="cursor-pointer">Percentage (%)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Commission Value */}
          <div className="space-y-2">
            <Label>Commission Value</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step={commissionType === 'percent' ? "1" : "0.01"}
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {commissionType === 'fixed' ? currencyCode + '$' : '%'}
              </span>
            </div>
          </div>

          {/* Commission Preview */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Partner Earns:</span>
              <span className="font-medium text-green-600">{currencyCode}${calculatedCommission.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You Receive:</span>
              <span className="font-medium">{currencyCode}${adminReceives.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedPartner || loading || parseFloat(commissionValue) <= 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
