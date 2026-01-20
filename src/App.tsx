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
import AdminSellersNew from "./pages/AdminSellersNew";
import AdminSellerRequests from "./pages/AdminSellerRequests";
import AdminHome from "./pages/AdminHome";
import SellerRegistration from "./pages/SellerRegistration";
import SellerAuth from "./pages/SellerAuth";
import SellerPending from "./pages/SellerPending";
import CustomerAuth from "./pages/CustomerAuth";
import AccountSettings from "./pages/AccountSettings";
import Auth from "./pages/Auth";
import LuutConnectAdmin from "./pages/LuutConnectAdmin";
import PartnerPortal from "./pages/PartnerPortal";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import ManagePartners from "./pages/ManagePartners";
import PartnerDetailsPage from "./pages/PartnerDetailsPage";
import AdminProductsPage from "./pages/AdminProductsPage";
// Seller Portal Pages
import SellerApply from "./pages/seller/SellerApply";
import SellerPendingNew from "./pages/seller/SellerPendingNew";
import SellerDashboardNew from "./pages/seller/SellerDashboardNew";
import SellerProducts from "./pages/seller/SellerProducts";
import SellerProductForm from "./pages/seller/SellerProductForm";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerAnalytics from "./pages/seller/SellerAnalytics";

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
          <Route path="/seller" element={<SellerDashboardNew />} />
          <Route path="/seller/apply" element={<SellerApply />} />
          <Route path="/seller/pending" element={<SellerPendingNew />} />
          <Route path="/seller/dashboard" element={<SellerDashboardNew />} />
          <Route path="/seller/products" element={<SellerProducts />} />
          <Route path="/seller/products/new" element={<SellerProductForm />} />
          <Route path="/seller/products/:productId" element={<SellerProductForm />} />
          <Route path="/seller/orders" element={<SellerOrders />} />
          <Route path="/seller/analytics" element={<SellerAnalytics />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/approvals" element={<AdminSellerRequests />} />
          <Route path="/admin/sellers" element={<AdminSellersNew />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/partners" element={<ManagePartners />} />
          <Route path="/admin/partners/:partnerId" element={<PartnerDetailsPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
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
