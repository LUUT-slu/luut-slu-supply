import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Check if there's browser history to go back to
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      // Fallback to shop page if no history
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
      Back
    </button>
  );
}
