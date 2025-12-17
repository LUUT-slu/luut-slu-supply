import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";

interface WhatsAppButtonProps {
  message?: string;
  variant?: "default" | "outline" | "ghost" | "floating";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

const WHATSAPP_NUMBER = "17584848888"; // Saint Lucia country code + number

export function WhatsAppButton({
  message = "Hi! I'm interested in shopping on Luut SLU.",
  variant = "default",
  size = "default",
  className = "",
  children,
}: WhatsAppButtonProps) {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;

  if (variant === "floating") {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg transition-transform hover:scale-110 md:h-16 md:w-16"
        aria-label="Message on WhatsApp"
      >
        <MessageCircle className="h-7 w-7 md:h-8 md:w-8" />
      </a>
    );
  }

  return (
    <Button
      asChild
      variant={variant === "outline" ? "outline" : "default"}
      size={size}
      className={`bg-whatsapp hover:bg-whatsapp/90 text-whatsapp-foreground ${className}`}
    >
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="mr-2 h-4 w-4" />
        {children || "Message on WhatsApp"}
      </a>
    </Button>
  );
}
