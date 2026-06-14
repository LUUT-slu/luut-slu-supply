import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, MapPin, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";
import { ProductReviews } from "@/components/ProductReviews";
import { ReviewPopup } from "@/components/ReviewPopup";
import { SEO } from "@/components/SEO";

interface LocalProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  description: string | null;
  images: string[] | null;
  category: string | null;
  location: string | null;
  status: string;
  created_at: string;
  seller_id: string;
  seller_profiles: {
    seller_name: string;
    location: string | null;
  };
}

export default function LocalProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const { trackEvent } = useAnalyticsTracker();
  
  const [product, setProduct] = useState<LocalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Track view
  useEffect(() => {
    if (product) {
      trackEvent({
        eventType: "product_viewed",
        productId: product.id,
        productName: product.name,
        productCategory: product.category || undefined,
        sellerId: product.seller_id,
      });
    }
  }, [product?.id]);

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from('seller_products')
        .select(`
          *,
          seller_profiles!inner(seller_name, location)
        `)
        .eq('id', productId)
        .single();

      if (error) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } else {
        setProduct(data as LocalProduct);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [productId]);

  const handleQuantityChange = (delta: number) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= (product?.quantity || 1)) {
      setQuantity(newQty);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    const isAvailable = product.quantity > 0 && product.status === 'active';
    if (!isAvailable) {
      toast.error("This product is currently unavailable");
      return;
    }

    // Create cart-compatible item structure
    const result = addItem({
      product: {
        node: {
          id: product.id,
          title: product.name,
          description: product.description || '',
          handle: `lovable-${product.id}`,
          vendor: product.seller_profiles.seller_name,
          productType: product.category || '',
          tags: [],
          createdAt: product.created_at,
          priceRange: {
            minVariantPrice: {
              amount: product.price.toString(),
              currencyCode: 'XCD',
            },
          },
          images: {
            edges: (product.images || []).map(url => ({
              node: { url, altText: product.name },
            })),
          },
          variants: {
            edges: [{
              node: {
                id: `lovable-variant-${product.id}`,
                title: 'Default',
                price: {
                  amount: product.price.toString(),
                  currencyCode: 'XCD',
                },
                availableForSale: isAvailable,
                selectedOptions: [],
              },
            }],
          },
          options: [],
        },
      },
      variantId: `lovable-variant-${product.id}`,
      variantTitle: 'Default',
      price: {
        amount: product.price.toString(),
        currencyCode: 'XCD',
      },
      quantity,
      selectedOptions: [],
    });

    if (result.success) {
      navigate('/cart');
    } else {
      toast.error(result.error || "Failed to add to cart");
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <BackButton />
          <div className="mt-4 space-y-4">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-10 w-32" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <BackButton />
          <div className="mt-8 text-center">
            <h1 className="text-2xl font-display text-foreground">Product Not Found</h1>
            <p className="mt-2 text-muted-foreground">This product may have been removed or is no longer available.</p>
            <Button className="mt-4" onClick={() => navigate('/shop')}>
              Back to Shop
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = product.images || [];
  const isAvailable = product.quantity > 0 && product.status === 'active';
  const totalPrice = product.price * quantity;

  const descPlain = (product.description || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const productPath = `/p/${product.id}`;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${product.name} — Luut SLU`.slice(0, 60)}
        description={descPlain || `Shop ${product.name} on Luut SLU — Saint Lucia's streetwear marketplace.`}
        path={productPath}
        type="product"
        image={images[0]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: descPlain || product.name,
          image: images,
          sku: product.id,
          brand: { "@type": "Brand", name: product.seller_profiles?.seller_name || "Luut SLU" },
          url: `https://luut-slu-supply.lovable.app${productPath}`,
          offers: {
            "@type": "Offer",
            price: product.price.toFixed(2),
            priceCurrency: "XCD",
            availability: isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `https://luut-slu-supply.lovable.app${productPath}`,
          },
        }}
      />
      <Header />
      <main className="container mx-auto px-4 py-6 pb-32">
        <BackButton />

        {/* Product Image */}
        <div className="mt-4">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
            {images.length > 0 ? (
              <img
                src={images[selectedImageIndex]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground">No image</span>
              </div>
            )}
          </div>

          {/* Image thumbnails */}
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`flex-shrink-0 h-16 w-16 rounded-md overflow-hidden border-2 transition-colors ${
                    idx === selectedImageIndex ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="mt-6 space-y-4">
          {/* Seller badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Local Seller
            </Badge>
            <span className="text-sm text-muted-foreground">
              {product.seller_profiles.seller_name}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-xl md:text-2xl text-foreground">
            {product.name}
          </h1>

          {/* Price */}
          <p className="font-display text-2xl md:text-3xl text-primary">
            EC${product.price.toFixed(2)}
          </p>

          {/* Description */}
          {product.description && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Availability */}
          {!isAvailable && (
            <p className="text-destructive font-medium">Out of Stock</p>
          )}

          {/* Quantity selector */}
          {isAvailable && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Quantity:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= product.quantity}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                ({product.quantity} available)
              </span>
            </div>
          )}
        </div>

        {/* Product Reviews */}
        <div className="mt-8 space-y-4">
          <ProductReviews productHandle={`lovable-${product.id}`} productTitle={product.name} />
          <ReviewPopup productHandle={`lovable-${product.id}`} productTitle={product.name} />
        </div>

        {/* Info sections */}
        <div className="mt-8 space-y-4">
          {/* Meetup Location */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Meetup Location</h3>
              <p className="text-sm text-muted-foreground">
                {product.location || product.seller_profiles.location || 'Contact seller for meetup details'}
              </p>
            </div>
          </div>

          {/* Payment Info */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <CreditCard className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Payment</h3>
              <p className="text-sm text-muted-foreground">
                Pay on meetup. Cash or mobile payment accepted.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky bottom actions */}
      {isAvailable && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4 space-y-2">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAddToCart}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Add to Cart - EC${totalPrice.toFixed(2)}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleBuyNow}
          >
            Buy Now
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
}
