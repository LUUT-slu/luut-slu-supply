import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ShopCategory from "./pages/ShopCategory";
import ProductDetail from "./pages/ProductDetail";
import SellOnLuut from "./pages/SellOnLuut";
import MeetupPolicy from "./pages/MeetupPolicy";
import DepositPolicy from "./pages/DepositPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import Sellers from "./pages/Sellers";
import SellerProfile from "./pages/SellerProfile";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import MyOrders from "./pages/MyOrders";
import OrderDetails from "./pages/OrderDetails";
import OrderComplete from "./pages/OrderComplete";
import AdminSellers from "./pages/AdminSellers";
import AdminSellerRequests from "./pages/AdminSellerRequests";
import AdminHome from "./pages/AdminHome";
import SellerRegistration from "./pages/SellerRegistration";
import SellerAuth from "./pages/SellerAuth";
import SellerDashboard from "./pages/SellerDashboard";
import SellerPending from "./pages/SellerPending";
import CustomerAuth from "./pages/CustomerAuth";
import AccountSettings from "./pages/AccountSettings";
import Auth from "./pages/Auth";
import LuutConnectAdmin from "./pages/LuutConnectAdmin";
import PartnerPortal from "./pages/PartnerPortal";
import AdminOrdersPage from "./pages/AdminOrdersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:category" element={<ShopCategory />} />
          <Route path="/product/:handle" element={<ProductDetail />} />
          <Route path="/sell" element={<SellOnLuut />} />
          <Route path="/meetup-policy" element={<MeetupPolicy />} />
          <Route path="/deposit-policy" element={<DepositPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/sellers" element={<Sellers />} />
          <Route path="/seller/:sellerId" element={<SellerProfile />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/my-orders" element={<MyOrders />} />
          <Route path="/order/:orderId" element={<OrderDetails />} />
          <Route path="/order-complete" element={<OrderComplete />} />
          
          {/* Auth Routes */}
          <Route path="/seller-auth" element={<SellerAuth />} />
          <Route path="/customer-auth" element={<CustomerAuth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/register-seller" element={<SellerRegistration />} />
          
          {/* Seller Routes */}
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/seller/pending" element={<SellerPending />} />
          <Route path="/seller-dashboard" element={<SellerDashboard />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/approvals" element={<AdminSellerRequests />} />
          <Route path="/admin/sellers" element={<AdminSellers />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin-orders" element={<AdminOrdersPage />} />
          
          {/* Partner Routes */}
          <Route path="/partner" element={<PartnerPortal />} />
          <Route path="/connect" element={<LuutConnectAdmin />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
