import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function WhatsAppConfirmPopup({ open, onOpenChange, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-2 border-primary bg-background p-6">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="font-display text-xl">
            Confirm Your Order on WhatsApp
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your order was created. To fully confirm it, send us a quick WhatsApp message so we can lock it in and arrange pickup.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <Button
            onClick={onConfirm}
            size="lg"
            className="w-full gap-2 text-base h-12"
          >
            <MessageCircle className="h-5 w-5" />
            Confirm on WhatsApp
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            size="lg"
            className="w-full h-12"
          >
            Review Order
          </Button>
          <p className="text-center text-xs text-muted-foreground pt-1">
            Meetups: Castries / Gros Islet / Rodney Bay.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
