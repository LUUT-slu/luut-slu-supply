import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  ShoppingBag, 
  Minus, 
  Plus, 
  Check,
  MapPin,
  CreditCard,
  Truck,
  MessageCircle,
  Shield,
  Clock,
  Store
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchProductByHandle, ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Meetup locations - can be extracted from product description or configured per seller
const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay"];

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ShopifyProduct["node"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const addItem = useCartStore((state) => state.addItem);
  const setCartOpen = useCartStore((state) => state.setOpen);

  useEffect(() => {
    async function loadProduct() {
      if (!handle) return;
      try {
        setLoading(true);
        const data = await fetchProductByHandle(handle);
        setProduct(data);
        if (data?.variants.edges[0]) {
          setSelectedVariant(data.variants.edges[0].node.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [handle]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">Product not found</p>
            <Button asChild>
              <Link to="/shop">Back to Shop</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currentVariant = product.variants.edges.find(
    (v) => v.node.id === selectedVariant
  )?.node;

  const handleAddToCart = () => {
    if (!currentVariant) return;

    addItem({
      product: { node: product },
      variantId: currentVariant.id,
      variantTitle: currentVariant.title,
      price: currentVariant.price,
      quantity,
      selectedOptions: currentVariant.selectedOptions,
    });

    toast.success("Added to cart!", {
      description: `${product.title} x ${quantity}`,
      position: "top-center",
    });
    setCartOpen(true);
  };

  const whatsappMessage = `Hi! I'm interested in: ${product.title}${
    currentVariant ? ` (${currentVariant.title})` : ""
  } - EC$${parseFloat(currentVariant?.price.amount || "0").toFixed(2)}`;

  // Check if seller is certified
  const isCertifiedSeller = product.vendor?.includes("Certified") || product.tags?.includes("certified-seller");
  const sellerName = product.vendor?.replace(" (Certified Seller)", "") || "Luut SLU";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-6">
          {/* Back button */}
          <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* ========== PRODUCT IMAGES ========== */}
            <div className="space-y-4 w-full max-w-full overflow-hidden">
              {/* Main Image - Fixed aspect ratio container */}
              <div className="relative w-full aspect-[4/5] max-h-[70vh] overflow-hidden rounded-xl bg-card border border-border">
                {product.images.edges.length > 1 ? (
                  // Swipeable gallery for multiple images
                  <div 
                    className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth touch-pan-x scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {product.images.edges.map((img, idx) => (
                      <div 
                        key={idx} 
                        className="h-full w-full flex-shrink-0 snap-center"
                      >
                        <img
                          src={img.node.url}
                          alt={img.node.altText || `${product.title} ${idx + 1}`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                ) : product.images.edges[0]?.node ? (
                  <img
                    src={product.images.edges[0].node.url}
                    alt={product.images.edges[0].node.altText || product.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Image indicators for swipe gallery */}
              {product.images.edges.length > 1 && (
                <div className="flex justify-center gap-1.5">
                  {product.images.edges.map((_, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full transition-colors",
                        selectedImage === idx ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              )}
              
              {/* Thumbnail strip for desktop */}
              {product.images.edges.length > 1 && (
                <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
                  {product.images.edges.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                        selectedImage === idx
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <img
                        src={img.node.url}
                        alt={img.node.altText || `${product.title} ${idx + 1}`}
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ========== PRODUCT DETAILS ========== */}
            <div className="space-y-6">
              {/* Seller Info */}
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sold by:</span>
                <Link
                  to={`/seller/${sellerName.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  {sellerName}
                </Link>
                {isCertifiedSeller && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Shield className="h-3 w-3" />
                    Certified
                  </Badge>
                )}
              </div>

              {/* Product Title */}
              <h1 className="font-display text-xl md:text-2xl leading-tight">
                {product.title}
              </h1>

              {/* Price */}
              {currentVariant && (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl md:text-3xl text-primary">
                    EC${parseFloat(currentVariant.price.amount).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {currentVariant.price.currencyCode}
                  </span>
                </div>
              )}

              <Separator />

              {/* ========== VARIANT OPTIONS ========== */}
              {product.options.map((option) => {
                // Skip default "Title" option if only one value
                if (option.name === "Title" && option.values.length === 1 && option.values[0] === "Default Title") {
                  return null;
                }
                return (
                  <div key={option.name}>
                    <label className="mb-3 block font-body text-sm font-medium">
                      {option.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const variant = product.variants.edges.find((v) =>
                          v.node.selectedOptions.some(
                            (o) => o.name === option.name && o.value === value
                          )
                        );
                        const isSelected = currentVariant?.selectedOptions.some(
                          (o) => o.name === option.name && o.value === value
                        );
                        const isAvailable = variant?.node.availableForSale;

                        return (
                          <Button
                            key={value}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            disabled={!isAvailable}
                            onClick={() => variant && setSelectedVariant(variant.node.id)}
                            className="min-w-[60px]"
                          >
                            {value}
                            {isSelected && <Check className="ml-1 h-3 w-3" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* ========== QUANTITY SELECTOR ========== */}
              <div>
                <label className="mb-3 block font-body text-sm font-medium">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-body text-lg font-medium">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ========== ADD TO CART BUTTON ========== */}
              <div className="space-y-3 pt-2">
                <Button
                  size="lg"
                  className="w-full text-base"
                  onClick={handleAddToCart}
                  disabled={!currentVariant?.availableForSale}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Add to Cart — EC${currentVariant ? (parseFloat(currentVariant.price.amount) * quantity).toFixed(2) : '0.00'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base"
                  onClick={() => {
                    handleAddToCart();
                  }}
                  disabled={!currentVariant?.availableForSale}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Buy Now
                </Button>
              </div>

              <Separator />

              {/* ========== MEETUP LOCATIONS ========== */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-sm tracking-wide">MEETUP LOCATIONS</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MEETUP_LOCATIONS.map((location) => (
                    <Badge key={location} variant="secondary" className="text-sm py-1 px-3">
                      {location}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Select your preferred location during checkout. Exact time confirmed via WhatsApp.
                </p>
              </div>

              {/* ========== PAYMENT METHOD ========== */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-sm tracking-wide">PAYMENT</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">Pay on Meetup (Cash)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">No upfront payment required</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Deposit may be required for pre-orders.{" "}
                  <Link to="/deposit-policy" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>
              </div>

              {/* ========== HOW IT WORKS ========== */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-sm tracking-wide">HOW IT WORKS</h3>
                </div>
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-medium">Add to Cart & Checkout</p>
                      <p className="text-xs text-muted-foreground">Choose your meetup location and date</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-medium">Order Confirmed</p>
                      <p className="text-xs text-muted-foreground">You'll receive an order number and confirmation</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-medium">Confirm on WhatsApp</p>
                      <p className="text-xs text-muted-foreground">Message us to finalize meetup time</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      4
                    </span>
                    <div>
                      <p className="text-sm font-medium">Meet & Pay</p>
                      <p className="text-xs text-muted-foreground">Collect your item and pay cash at meetup</p>
                    </div>
                  </li>
                </ol>
              </div>

              {/* ========== PRODUCT DESCRIPTION ========== */}
              {product.description && (
                <div>
                  <h3 className="mb-3 font-display text-sm tracking-wide">DESCRIPTION</h3>
                  <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}

              {/* ========== TAGS ========== */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* ========== TRUST INDICATORS ========== */}
              <div className="flex items-center justify-center gap-6 pt-4 border-t border-border text-muted-foreground">
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="h-4 w-4" />
                  <span>Verified Seller</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-4 w-4" />
                  <span>Quick Response</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="h-4 w-4" />
                  <span>Local Meetup</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}