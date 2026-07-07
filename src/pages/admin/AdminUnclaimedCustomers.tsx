import { Navigate } from "react-router-dom";

export default function AdminUnclaimedCustomers() {
  return <Navigate to="/admin/customers?tab=unclaimed" replace />;
}
