import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
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
  Store,
  Ruler,
  X } from
"lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatButton } from "@/components/ChatButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { fetchProductByHandle, ShopifyProduct, normalizeVendorName } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { ProductReviews } from "@/components/ProductReviews";
import { ReviewPopup } from "@/components/ReviewPopup";

const WHATSAPP_NUMBER = "17587185478";
const COLOR_OPTION_NAMES = ["color", "colour"];
const SIZE_OPTION_NAMES = ["size"];

// Meetup locations - can be extracted from product description or configured per seller
const MEETUP_LOCATIONS = ["Castries", "Gros Islet", "Rodney Bay"];

export default function ProductDetail() {
  const { handle } = useParams<{handle: string;}>();
  const navigate = useNavigate();
  const [searchParams] = [new URLSearchParams(window.location.search)];
  const [product, setProduct] = useState<ShopifyProduct["node"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showAllColors, setShowAllColors] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  const addItem = useCartStore((state) => state.addItem);
  const { trackEvent } = useAnalyticsTracker();

  // Track product view once loaded
  useEffect(() => {
    if (product) {
      trackEvent({
        eventType: "product_viewed",
        productId: product.id,
        productName: product.title,
        productCategory: product.productType || undefined,
        sellerId: product.vendor || undefined,
      });
    }
  }, [product?.id]);
  useEffect(() => {
    async function loadProduct() {
      if (!handle) return;
      try {
        setLoading(true);
        const data = await fetchProductByHandle(handle);
        setProduct(data);
        // Check for variant query param for deep-linking from color cards
        const variantParam = searchParams.get('variant');
        if (variantParam && data?.variants.edges.some(v => v.node.id === variantParam)) {
          setSelectedVariant(variantParam);
        } else if (data?.variants.edges[0]) {
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

  // Scroll gallery to a specific image index
  const scrollToImage = useCallback((index: number) => {
    const container = galleryRef.current;
    if (!container) return;
    const scrollTarget = index * container.offsetWidth;
    container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    setSelectedImage(index);
  }, []);

  // Track scroll position to update selectedImage indicator
  useEffect(() => {
    const container = galleryRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const idx = Math.round(container.scrollLeft / container.offsetWidth);
          setSelectedImage(idx);
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [product]);

  // When selectedVariant changes, scroll gallery to matching variant image
  useEffect(() => {
    if (!product || !selectedVariant) return;

    const variant = product.variants.edges.find((v) => v.node.id === selectedVariant)?.node;
    if (!variant?.image?.url) return;

    // Find the index of the variant image in the product images list
    const imageIndex = product.images.edges.findIndex(
      (img) => img.node.url === variant.image!.url
    );

    if (imageIndex >= 0 && imageIndex !== selectedImage) {
      scrollToImage(imageIndex);
    }
  }, [selectedVariant, product, scrollToImage]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
        <Footer />
      </div>);

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
      </div>);

  }

  // Identify color & size options
  const colorOption = product.options.find((o) =>
    COLOR_OPTION_NAMES.includes(o.name.toLowerCase())
  );
  const sizeOption = product.options.find((o) =>
    SIZE_OPTION_NAMES.includes(o.name.toLowerCase())
  );
  const otherOptions = product.options.filter(
    (o) =>
      o !== colorOption &&
      o !== sizeOption &&
      !(o.name === "Title" && o.values.length === 1 && o.values[0] === "Default Title")
  );

  const currentVariant = product.variants.edges.find(
    (v) => v.node.id === selectedVariant
  )?.node;

  const selectedColor = currentVariant?.selectedOptions.find((o) =>
    COLOR_OPTION_NAMES.includes(o.name.toLowerCase())
  )?.value;
  const selectedSize = currentVariant?.selectedOptions.find((o) =>
    SIZE_OPTION_NAMES.includes(o.name.toLowerCase())
  )?.value;

  // Map color value -> first matching variant (for swatch image + click target)
  const colorVariantMap = new Map<string, typeof product.variants.edges[number]["node"]>();
  if (colorOption) {
    for (const value of colorOption.values) {
      const v = product.variants.edges.find((e) =>
        e.node.selectedOptions.some(
          (o) => COLOR_OPTION_NAMES.includes(o.name.toLowerCase()) && o.value === value
        )
      );
      if (v) colorVariantMap.set(value, v.node);
    }
  }

  const isOutOfStock = currentVariant ? !currentVariant.availableForSale : false;
  const totalImages = product.images.edges.length;

  const buildWhatsAppMessage = (restock = false) => {
    const parts: string[] = [];
    if (restock) {
      parts.push(`Hi LUUT, is "${product.title}" coming back in stock?`);
    } else {
      let line = `Hi LUUT, I'm interested in ${product.title}`;
      if (selectedColor) line += ` — ${selectedColor}`;
      if (selectedSize) line += ` — ${selectedSize}`;
      line += ` — Qty: ${quantity}. Is it still available?`;
      parts.push(line);
    }
    if (typeof window !== "undefined") parts.push(window.location.href);
    return parts.join("\n");
  };

  const validateSelection = () => {
    if (colorOption && colorOption.values.length > 1 && !selectedColor) {
      toast.error("Please select a color.");
      return false;
    }
    if (sizeOption && sizeOption.values.length > 1 && !selectedSize) {
      toast.error("Please select a size.");
      return false;
    }
    return true;
  };

  const doAddToCart = (): boolean => {
    if (!currentVariant) return false;
    if (!validateSelection()) return false;
    const result = addItem({
      product: { node: product },
      variantId: currentVariant.id,
      variantTitle: currentVariant.title,
      price: currentVariant.price,
      quantity,
      selectedOptions: currentVariant.selectedOptions,
    });
    if (!result.success) {
      toast.error("Cannot add to cart", {
        description: result.error,
        position: "top-center",
        duration: 5000,
      });
      return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    if (doAddToCart()) {
      toast.success("Added to cart");
      trackEvent({
        eventType: "add_to_cart",
        productId: product.id,
        productName: product.title,
        sellerId: product.vendor || undefined,
        metadata: {
          variantId: currentVariant?.id,
          color: selectedColor,
          size: selectedSize,
          quantity,
        },
      });
    }
  };

  const handleBuyNow = () => {
    if (doAddToCart()) {
      trackEvent({
        eventType: "buy_now_clicked",
        productId: product.id,
        productName: product.title,
        sellerId: product.vendor || undefined,
        metadata: {
          variantId: currentVariant?.id,
          color: selectedColor,
          size: selectedSize,
          quantity,
        },
      });
      navigate("/checkout");
    }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(buildWhatsAppMessage(isOutOfStock));
    trackEvent({
      eventType: "whatsapp_clicked",
      productId: product.id,
      productName: product.title,
      sellerId: product.vendor || undefined,
      metadata: {
        variantId: currentVariant?.id,
        color: selectedColor,
        size: selectedSize,
        quantity,
        restock: isOutOfStock,
      },
    });
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const handleSelectColor = (value: string) => {
    const v = colorVariantMap.get(value);
    if (!v) return;
    // Try to keep current size if possible
    if (sizeOption && selectedSize) {
      const match = product.variants.edges.find((e) =>
        e.node.selectedOptions.every((o) => {
          if (COLOR_OPTION_NAMES.includes(o.name.toLowerCase())) return o.value === value;
          if (SIZE_OPTION_NAMES.includes(o.name.toLowerCase())) return o.value === selectedSize;
          return true;
        })
      );
      setSelectedVariant(match?.node.id ?? v.id);
    } else {
      setSelectedVariant(v.id);
    }
    trackEvent({
      eventType: "variant_color_selected",
      productId: product.id,
      productName: product.title,
      metadata: { color: value },
    });
  };

  const handleSelectSize = (value: string) => {
    const match = product.variants.edges.find((e) =>
      e.node.selectedOptions.every((o) => {
        if (SIZE_OPTION_NAMES.includes(o.name.toLowerCase())) return o.value === value;
        if (COLOR_OPTION_NAMES.includes(o.name.toLowerCase()) && selectedColor)
          return o.value === selectedColor;
        return true;
      })
    );
    if (match) setSelectedVariant(match.node.id);
    trackEvent({
      eventType: "variant_size_selected",
      productId: product.id,
      productName: product.title,
      metadata: { size: value },
    });
  };

  const handleQtyChange = (next: number) => {
    const clamped = Math.max(1, next);
    setQuantity(clamped);
    trackEvent({
      eventType: "quantity_changed",
      productId: product.id,
      productName: product.title,
      metadata: { quantity: clamped },
    });
  };

  // Check if seller is certified
  const isCertifiedSeller = product.vendor?.includes("Certified") || product.tags?.includes("certified-seller");
  const sellerName = normalizeVendorName(product.vendor?.replace(" (Certified Seller)", "") || "Luut SLU");

  const MAX_COLOR_SWATCHES = 4;
  const visibleColors = colorOption
    ? (showAllColors ? colorOption.values : colorOption.values.slice(0, MAX_COLOR_SWATCHES))
    : [];
  const hiddenColorCount = colorOption ? Math.max(0, colorOption.values.length - MAX_COLOR_SWATCHES) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-4 md:py-6">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* ========== PRODUCT IMAGES ========== */}
            <div className="space-y-3 w-full max-w-full">
              {/* Main Image */}
              <div className="relative w-full aspect-square overflow-hidden rounded-2xl bg-card">
                {totalImages > 1 ? (
                  <div
                    className="flex h-full w-full snap-x snap-mandatory overflow-x-scroll overscroll-x-contain"
                    ref={galleryRef}
                    style={{
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    <style>{`div::-webkit-scrollbar { display: none; }`}</style>
                    {product.images.edges.map((img, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setLightboxOpen(true)}
                        className="h-full min-w-full flex-shrink-0 snap-center flex items-center justify-center bg-card"
                      >
                        <img
                          src={img.node.url}
                          alt={img.node.altText || `${product.title} ${idx + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                ) : product.images.edges[0]?.node ? (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="h-full w-full flex items-center justify-center"
                  >
                    <img
                      src={product.images.edges[0].node.url}
                      alt={product.images.edges[0].node.altText || product.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}

                {/* Image count indicator */}
                {totalImages > 1 && (
                  <div className="absolute bottom-3 right-3 rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                    {selectedImage + 1}/{totalImages}
                  </div>
                )}
              </div>

              {/* Carousel dots */}
              {totalImages > 1 && (
                <div className="flex justify-center gap-1.5">
                  {product.images.edges.slice(0, 5).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToImage(idx)}
                      className={cn(
                        "h-2 w-2 rounded-full transition-colors",
                        selectedImage === idx ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Thumbnail strip for desktop */}
              {totalImages > 1 && (
                <div className="hidden md:flex gap-2 overflow-x-auto pb-2">
                  {product.images.edges.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToImage(idx)}
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
            <div className="space-y-5">
              {/* Seller Info */}
              <div className="flex items-center gap-4 text-sm">
                <Link
                  to={`/seller/${encodeURIComponent(sellerName.toLowerCase().replace(/\s+/g, "-"))}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Store className="h-4 w-4" />
                  <span>Sold by:</span>
                  <span className="font-medium text-foreground">{sellerName}</span>
                </Link>
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <Shield className="h-4 w-4" />
                  Verified Seller
                </span>
              </div>

              {/* Product Title */}
              <h1 className="text-2xl md:text-3xl leading-tight font-sans text-foreground">
                {product.title}
              </h1>

              {/* Price */}
              {currentVariant && (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl text-primary font-sans">
                    EC${parseFloat(currentVariant.price.amount).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {currentVariant.price.currencyCode}
                  </span>
                </div>
              )}

              {/* ========== COLOR SELECTOR ========== */}
              {colorOption && colorOption.values.length > 1 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="font-body text-sm font-medium text-foreground">Color</label>
                    <span className="text-sm text-muted-foreground">
                      {selectedColor || "Select"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {visibleColors.map((value) => {
                      const v = colorVariantMap.get(value);
                      const swatchImg =
                        v?.image?.url ||
                        product.images.edges[0]?.node.url;
                      const isSelected = selectedColor === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleSelectColor(value)}
                          aria-label={value}
                          className={cn(
                            "relative h-12 w-12 overflow-hidden rounded-full border-2 transition-all",
                            isSelected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border hover:border-muted-foreground"
                          )}
                        >
                          {swatchImg ? (
                            <img
                              src={swatchImg}
                              alt={value}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px]">
                              {value}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {hiddenColorCount > 0 && (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-border text-xs text-muted-foreground">
                        +{hiddenColorCount}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========== SIZE SELECTOR ========== */}
              {sizeOption && sizeOption.values.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="font-body text-sm font-medium text-foreground">Size</label>
                    <span className="text-sm text-muted-foreground">
                      {selectedSize || "Select"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sizeOption.values.map((value) => {
                      const variant = product.variants.edges.find((e) =>
                        e.node.selectedOptions.some(
                          (o) =>
                            SIZE_OPTION_NAMES.includes(o.name.toLowerCase()) &&
                            o.value === value
                        )
                      );
                      const isSelected = selectedSize === value;
                      const isAvailable = variant?.node.availableForSale ?? true;
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => handleSelectSize(value)}
                          className={cn(
                            "min-w-[60px] rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                            isSelected
                              ? "border-primary text-primary bg-primary/5"
                              : "border-border text-foreground hover:border-muted-foreground",
                            !isAvailable && "opacity-40 line-through cursor-not-allowed"
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => toast.info("Size guide coming soon")}
                      className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Ruler className="h-3.5 w-3.5" />
                      Size Guide
                    </button>
                  </div>
                </div>
              )}

              {/* ========== OTHER VARIANT OPTIONS ========== */}
              {otherOptions.map((option) => (
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
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ========== QUANTITY SELECTOR ========== */}
              <div>
                <label className="mb-3 block font-body text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg"
                    onClick={() => handleQtyChange(quantity - 1)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-body text-lg font-medium">
                    {quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg"
                    onClick={() => handleQtyChange(quantity + 1)}
                    disabled={isOutOfStock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {isOutOfStock && (
                    <span className="text-xs text-destructive font-medium">Sold out</span>
                  )}
                </div>
              </div>

              {/* ========== ACTION BUTTONS ========== */}
              <div className="space-y-3 pt-2">
                {/* PRIMARY: WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="w-full rounded-xl bg-primary py-3 px-4 text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <span className="flex items-center justify-center gap-2 text-base font-semibold">
                    <MessageCircle className="h-5 w-5" />
                    {isOutOfStock ? "Ask About Restock" : "Ask on WhatsApp"}
                  </span>
                  <span className="block text-xs font-normal opacity-80 mt-0.5">
                    Chat with us about this item
                  </span>
                </button>

                {/* SECONDARY: Add to Cart */}
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base rounded-xl border-primary text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Add to Cart — EC$
                  {currentVariant
                    ? (parseFloat(currentVariant.price.amount) * quantity).toFixed(2)
                    : "0.00"}
                </Button>

                {/* TERTIARY: Buy Now */}
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base rounded-xl"
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
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
                  {MEETUP_LOCATIONS.map((location) =>
                  <Badge key={location} variant="secondary" className="text-sm py-1 px-3">
                      {location}
                    </Badge>
                  )}
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
              {product.description &&
              <div>
                  <h3 className="mb-3 font-display text-sm tracking-wide">DESCRIPTION</h3>
                  <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              }

              {/* ========== PRODUCT REVIEWS ========== */}
              <Separator />
              <ProductReviews productHandle={handle || ""} productTitle={product.title} />
              <ReviewPopup productHandle={handle} productTitle={product.title} />

              {/* ========== TAGS ========== */}
              {product.tags && product.tags.length > 0 &&
              <div className="flex flex-wrap gap-2 pt-2">
                  {product.tags.map((tag) =>
                <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                )}
                </div>
              }

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

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl bg-background border-border p-0 overflow-hidden">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-background/70 p-2 text-foreground backdrop-blur"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={product.images.edges[selectedImage]?.node.url}
              alt={product.title}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
      <ChatButton variant="floating" />
    </div>);

}