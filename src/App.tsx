import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { RouteGuard } from "@/components/RouteGuard";
import { SalePopup } from "@/components/SalePopup";
import Index from "./pages/Index";

// Retry wrapper for lazy imports — handles stale chunk errors after deploys
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch(() => {
      // If the chunk fails to load, reload the page once
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves, page will reload
      }
      sessionStorage.removeItem("chunk_reload");
      return importFn(); // retry once more, let it throw if still broken
    })
  );
}

// Lazy-loaded routes for code splitting
const Shop = lazyRetry(() => import("./pages/Shop"));
const ShopCategory = lazyRetry(() => import("./pages/ShopCategory"));
const ProductDetail = lazyRetry(() => import("./pages/ProductDetail"));
const LocalProductDetail = lazyRetry(() => import("./pages/LocalProductDetail"));
const NewArrivals = lazyRetry(() => import("./pages/NewArrivals"));
const BestSellersPage = lazyRetry(() => import("./pages/BestSellers"));
const Cart = lazyRetry(() => import("./pages/Cart"));
const Checkout = lazyRetry(() => import("./pages/Checkout"));
const SellOnLuut = lazyRetry(() => import("./pages/SellOnLuut"));
const MeetupPolicy = lazyRetry(() => import("./pages/MeetupPolicy"));
const DepositPolicy = lazyRetry(() => import("./pages/DepositPolicy"));
const RefundPolicy = lazyRetry(() => import("./pages/RefundPolicy"));
const Sellers = lazyRetry(() => import("./pages/Sellers"));
const SellerProfile = lazyRetry(() => import("./pages/SellerProfile"));
const Contact = lazyRetry(() => import("./pages/Contact"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const MyOrders = lazyRetry(() => import("./pages/MyOrders"));
const OrderDetails = lazyRetry(() => import("./pages/OrderDetails"));
const OrderComplete = lazyRetry(() => import("./pages/OrderComplete"));
const OrderConfirmed = lazyRetry(() => import("./pages/OrderConfirmed"));
const AdminSellersNew = lazyRetry(() => import("./pages/AdminSellersNew"));
const AdminSellerRequests = lazyRetry(() => import("./pages/AdminSellerRequests"));
const AdminHome = lazyRetry(() => import("./pages/AdminHome"));
const SellerRegistration = lazyRetry(() => import("./pages/SellerRegistration"));
const CustomerAuth = lazyRetry(() => import("./pages/CustomerAuth"));
const AccountSettings = lazyRetry(() => import("./pages/AccountSettings"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const Login = lazyRetry(() => import("./pages/Login"));
const LuutConnectAdmin = lazyRetry(() => import("./pages/LuutConnectAdmin"));
const PartnerPortal = lazyRetry(() => import("./pages/PartnerPortal"));
const AdminOrdersPage = lazyRetry(() => import("./pages/AdminOrdersPage"));
const ManagePartners = lazyRetry(() => import("./pages/ManagePartners"));
const PartnerDetailsPage = lazyRetry(() => import("./pages/PartnerDetailsPage"));
const AdminProductsPage = lazyRetry(() => import("./pages/AdminProductsPage"));
// Seller Portal Pages
const SellerApply = lazyRetry(() => import("./pages/seller/SellerApply"));
const SellerPendingNew = lazyRetry(() => import("./pages/seller/SellerPendingNew"));
const SellerDashboardNew = lazyRetry(() => import("./pages/seller/SellerDashboardNew"));
const SellerProducts = lazyRetry(() => import("./pages/seller/SellerProducts"));
const SellerProductForm = lazyRetry(() => import("./pages/seller/SellerProductForm"));
const SellerOrders = lazyRetry(() => import("./pages/seller/SellerOrders"));
const SellerOrderDetail = lazyRetry(() => import("./pages/seller/SellerOrderDetail"));
const SellerAnalytics = lazyRetry(() => import("./pages/seller/SellerAnalytics"));
const SellerSettingsPage = lazyRetry(() => import("./pages/seller/SellerSettingsPage"));
const AdminSiteSettings = lazyRetry(() => import("./pages/AdminSiteSettings"));
const DiscountRedirect = lazyRetry(() => import("./pages/DiscountRedirect"));

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
        <SalePopup />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/new-arrivals" element={<NewArrivals />} />
            <Route path="/shop/best-sellers" element={<BestSellersPage />} />
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
            <Route path="/seller/settings" element={
              <RouteGuard requiredRole="seller" showApplyPage="/seller/apply">
                <SellerSettingsPage />
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
            <Route path="/admin/site-settings" element={
              <RouteGuard requiredRole="admin">
                <AdminSiteSettings />
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
            
            {/* Discount redirect route */}
            <Route path="/discount/:code" element={<DiscountRedirect />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
