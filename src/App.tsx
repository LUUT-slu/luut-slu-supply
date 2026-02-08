import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RouteGuard } from "@/components/RouteGuard";
import Index from "./pages/Index";

// Lazy-loaded routes for code splitting
const Shop = lazy(() => import("./pages/Shop"));
const ShopCategory = lazy(() => import("./pages/ShopCategory"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const LocalProductDetail = lazy(() => import("./pages/LocalProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const SellOnLuut = lazy(() => import("./pages/SellOnLuut"));
const MeetupPolicy = lazy(() => import("./pages/MeetupPolicy"));
const DepositPolicy = lazy(() => import("./pages/DepositPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Sellers = lazy(() => import("./pages/Sellers"));
const SellerProfile = lazy(() => import("./pages/SellerProfile"));
const Contact = lazy(() => import("./pages/Contact"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const OrderComplete = lazy(() => import("./pages/OrderComplete"));
const OrderConfirmed = lazy(() => import("./pages/OrderConfirmed"));
const AdminSellersNew = lazy(() => import("./pages/AdminSellersNew"));
const AdminSellerRequests = lazy(() => import("./pages/AdminSellerRequests"));
const AdminHome = lazy(() => import("./pages/AdminHome"));
const SellerRegistration = lazy(() => import("./pages/SellerRegistration"));
const CustomerAuth = lazy(() => import("./pages/CustomerAuth"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const Auth = lazy(() => import("./pages/Auth"));
const Login = lazy(() => import("./pages/Login"));
const LuutConnectAdmin = lazy(() => import("./pages/LuutConnectAdmin"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage"));
const ManagePartners = lazy(() => import("./pages/ManagePartners"));
const PartnerDetailsPage = lazy(() => import("./pages/PartnerDetailsPage"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage"));
// Seller Portal Pages
const SellerApply = lazy(() => import("./pages/seller/SellerApply"));
const SellerPendingNew = lazy(() => import("./pages/seller/SellerPendingNew"));
const SellerDashboardNew = lazy(() => import("./pages/seller/SellerDashboardNew"));
const SellerProducts = lazy(() => import("./pages/seller/SellerProducts"));
const SellerProductForm = lazy(() => import("./pages/seller/SellerProductForm"));
const SellerOrders = lazy(() => import("./pages/seller/SellerOrders"));
const SellerOrderDetail = lazy(() => import("./pages/seller/SellerOrderDetail"));
const SellerAnalytics = lazy(() => import("./pages/seller/SellerAnalytics"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:category" element={<ShopCategory />} />
            <Route path="/product/:handle" element={<ProductDetail />} />
            <Route path="/product/local/:productId" element={<LocalProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/sell" element={<SellOnLuut />} />
            <Route path="/meetup-policy" element={<MeetupPolicy />} />
            <Route path="/deposit-policy" element={<DepositPolicy />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/sellers" element={<Sellers />} />
            <Route path="/seller/:sellerId" element={<SellerProfile />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/order/:orderId" element={<OrderDetails />} />
            <Route path="/order-confirmed" element={<OrderConfirmed />} />
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
            <Route path="/seller/orders/:orderId" element={
              <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
                <SellerOrderDetail />
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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
