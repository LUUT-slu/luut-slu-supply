import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function DiscountRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      sessionStorage.setItem("luut-discount-code", code.toUpperCase());
    }
    navigate("/shop", { replace: true });
  }, [code, navigate]);

  return null;
}
