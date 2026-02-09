import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";

interface ChatButtonProps {
  variant?: "default" | "outline" | "ghost" | "floating";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
}

const WHATSAPP_URL = "https://wa.me/17587185478?text=" + encodeURIComponent("Hi LUUT SLU, I need help with: [type here]");

export function ChatButton({
  variant = "default",
  size = "default",
  className = "",
  children,
}: ChatButtonProps) {
  const handleClick = () => {
    window.open(WHATSAPP_URL, '_blank');
  };

  if (variant === "floating") {
    return (
      <button
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:h-16 md:w-16"
        aria-label="Chat with us"
      >
        <MessageCircle className="h-7 w-7 md:h-8 md:w-8" />
      </button>
    );
  }

  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      size={size}
      onClick={handleClick}
      className={className}
    >
      <MessageCircle className="mr-2 h-4 w-4" />
      {children || "Chat with Us"}
    </Button>
  );
}
