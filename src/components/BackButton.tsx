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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className="mb-4"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back
    </Button>
  );
}
