import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RouteGuard } from "@/components/RouteGuard";
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
import CustomerAuth from "./pages/CustomerAuth";
import AccountSettings from "./pages/AccountSettings";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
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
          <Route path="/login" element={<Login />} />
          <Route path="/seller-auth" element={<Login />} />
          <Route path="/customer-auth" element={<CustomerAuth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/register-seller" element={<SellerRegistration />} />
          
          {/* Customer Account (any authenticated user) */}
          <Route path="/account" element={
            <RouteGuard requiredRole="authenticated">
              <AccountSettings />
            </RouteGuard>
          } />
          
          {/* Seller Routes (requires seller role + approval) */}
          <Route path="/seller" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerDashboardNew />
            </RouteGuard>
          } />
          <Route path="/seller/apply" element={<SellerApply />} />
          <Route path="/seller/pending" element={<SellerPendingNew />} />
          <Route path="/seller/dashboard" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerDashboardNew />
            </RouteGuard>
          } />
          <Route path="/seller/products" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerProducts />
            </RouteGuard>
          } />
          <Route path="/seller/products/new" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerProductForm />
            </RouteGuard>
          } />
          <Route path="/seller/products/:productId" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerProductForm />
            </RouteGuard>
          } />
          <Route path="/seller/orders" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerOrders />
            </RouteGuard>
          } />
          <Route path="/seller/analytics" element={
            <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
              <SellerAnalytics />
            </RouteGuard>
          } />
          
          {/* Admin Routes (requires admin role) */}
          <Route path="/admin" element={
            <RouteGuard requiredRole="admin">
              <AdminHome />
            </RouteGuard>
          } />
          <Route path="/admin/approvals" element={
            <RouteGuard requiredRole="admin">
              <AdminSellerRequests />
            </RouteGuard>
          } />
          <Route path="/admin/sellers" element={
            <RouteGuard requiredRole="admin">
              <AdminSellersNew />
            </RouteGuard>
          } />
          <Route path="/admin/orders" element={
            <RouteGuard requiredRole="admin">
              <AdminOrdersPage />
            </RouteGuard>
          } />
          <Route path="/admin/partners" element={
            <RouteGuard requiredRole="admin">
              <ManagePartners />
            </RouteGuard>
          } />
          <Route path="/admin/partners/:partnerId" element={
            <RouteGuard requiredRole="admin">
              <PartnerDetailsPage />
            </RouteGuard>
          } />
          <Route path="/admin/products" element={
            <RouteGuard requiredRole="admin">
              <AdminProductsPage />
            </RouteGuard>
          } />
          <Route path="/admin-orders" element={
            <RouteGuard requiredRole="admin">
              <AdminOrdersPage />
            </RouteGuard>
          } />
          
          {/* Partner Routes (requires partner role + approval) */}
          <Route path="/partner" element={
            <RouteGuard requiredRole="partner">
              <PartnerPortal />
            </RouteGuard>
          } />
          <Route path="/connect" element={
            <RouteGuard requiredRole="admin">
              <LuutConnectAdmin />
            </RouteGuard>
          } />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
