import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Minus, Plus, Check } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchProductByHandle, ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";

export default function ProductDetail() {
  const { handle } = useParams<{ handle: string }>();
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
  } - $${parseFloat(currentVariant?.price.amount || "0").toFixed(2)} XCD`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-6">
          {/* Back button */}
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/shop">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Shop
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Images */}
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-lg bg-card">
                {product.images.edges[selectedImage]?.node ? (
                  <img
                    src={product.images.edges[selectedImage].node.url}
                    alt={product.images.edges[selectedImage].node.altText || product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-20 w-20 text-muted-foreground" />
                  </div>
                )}
              </div>
              {product.images.edges.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.edges.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 ${
                        selectedImage === idx
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={img.node.url}
                        alt={img.node.altText || `${product.title} ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Sold by:{" "}
                  <Link
                    to={`/seller/${product.vendor || "luut-slu"}`}
                    className="text-foreground hover:text-primary"
                  >
                    {product.vendor || "Luut SLU"}
                  </Link>
                </p>
                <h1 className="font-display text-3xl md:text-4xl">
                  {product.title}
                </h1>
                {currentVariant && (
                  <p className="mt-4 font-display text-3xl text-primary">
                    ${parseFloat(currentVariant.price.amount).toFixed(2)}{" "}
                    {currentVariant.price.currencyCode}
                  </p>
                )}
              </div>

              {/* Options */}
              {product.options.map((option) => (
                <div key={option.name}>
                  <label className="mb-2 block font-body text-sm font-medium">
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
              ))}

              {/* Quantity */}
              <div>
                <label className="mb-2 block font-body text-sm font-medium">
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
                  <span className="w-12 text-center font-body text-lg">
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

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleAddToCart}
                  disabled={!currentVariant?.availableForSale}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Add to Cart
                </Button>
                <WhatsAppButton
                  message={whatsappMessage}
                  className="w-full"
                  size="lg"
                >
                  Message Seller on WhatsApp
                </WhatsAppButton>
              </div>

              {/* Payment info */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-2 font-display text-sm">PAYMENT</h3>
                <p className="font-body text-sm text-muted-foreground">
                  Pay on meetup (cash). Deposit required for pre-orders.{" "}
                  <Link to="/deposit-policy" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>
              </div>

              {/* Description */}
              {product.description && (
                <div>
                  <h3 className="mb-2 font-display text-lg">DESCRIPTION</h3>
                  <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <WhatsAppButton variant="floating" />
    </div>
  );
}
