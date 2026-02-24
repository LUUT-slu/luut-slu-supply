import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/shop");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-95 touch-manipulation"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
