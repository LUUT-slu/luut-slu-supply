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
import AdminOrders from "./pages/AdminOrders";
import AdminSellers from "./pages/AdminSellers";
import SellerRegistration from "./pages/SellerRegistration";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
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
          <Route path="/register-seller" element={<SellerRegistration />} />
          <Route path="/admin" element={<AdminOrders />} />
          <Route path="/admin/sellers" element={<AdminSellers />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
