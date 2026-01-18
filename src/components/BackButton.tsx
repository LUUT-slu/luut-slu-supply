import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useRef } from "react";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/shop");
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Only trigger if it's a tap (minimal movement)
    if (deltaX < 10 && deltaY < 10) {
      handleBack();
    }
    
    touchStartRef.current = null;
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        // Only handle click for non-touch devices
        if (e.detail > 0 && !('ontouchstart' in window)) {
          handleBack();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 touch-manipulation"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
