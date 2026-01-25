import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SellerRouteGuard } from "@/components/seller/SellerRouteGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, X, Package } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/lib/categories";

// Categories now come from the unified category system
const LOCATIONS = ["Castries", "Gros Islet", "Vieux Fort", "Rodney Bay", "Soufriere", "Other"];

interface ProductData {
  name: string;
  price: string;
  quantity: string;
  location: string;
  description: string;
  category: string;
}

export default function SellerProductForm() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const { profile } = useSellerProfile();
  const isEditing = Boolean(productId);

  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [formData, setFormData] = useState<ProductData>({
    name: "",
    price: "",
    quantity: "1",
    location: "",
    description: "",
    category: "",
  });

  useEffect(() => {
    if (isEditing && profile?.id) {
      fetchProduct();
    }
  }, [isEditing, productId, profile?.id]);

  const fetchProduct = async () => {
    if (!productId) return;

    const { data, error } = await supabase
      .from("seller_products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error) {
      toast.error("Product not found");
      navigate("/seller/products");
      return;
    }

    setFormData({
      name: data.name,
      price: data.price.toString(),
      quantity: data.quantity.toString(),
      location: data.location || "",
      description: data.description || "",
      category: data.category || "",
    });
    setExistingImages(data.images || []);
    setLoadingProduct(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length + existingImages.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    setImageFiles((prev) => [...prev, ...files]);

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (!profile?.id) return [];

    const uploadedUrls: string[] = [];

    for (const file of imageFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("seller-assets")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("seller-assets")
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.id) {
      toast.error("Seller profile not found");
      return;
    }

    if (!formData.name || !formData.price) {
      toast.error("Please fill in required fields");
      return;
    }

    const totalImages = existingImages.length + imageFiles.length;
    if (totalImages === 0) {
      toast.error("Please add at least one image");
      return;
    }

    setLoading(true);

    try {
      // Upload new images
      const newImageUrls = await uploadImages();
      const allImages = [...existingImages, ...newImageUrls];

      const productData = {
        seller_id: profile.id,
        name: formData.name,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity) || 0,
        location: formData.location || null,
        description: formData.description || null,
        category: formData.category || null,
        images: allImages,
        status: "active",
      };

      if (isEditing && productId) {
        const { error } = await supabase
          .from("seller_products")
          .update(productData)
          .eq("id", productId);

        if (error) throw error;
        toast.success("Product updated!");
      } else {
        const { error } = await supabase
          .from("seller_products")
          .insert(productData);

        if (error) throw error;
        toast.success("Product created!");
      }

      navigate("/seller/products");
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  if (loadingProduct) {
    return (
      <SellerRouteGuard>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </SellerRouteGuard>
    );
  }

  return (
    <SellerRouteGuard>
      <div className="flex min-h-screen flex-col bg-background">
        <SellerNav
          sellerName={profile?.seller_name}
          logoUrl={profile?.logo_url || undefined}
        />

        <main className="container flex-1 py-4 md:py-6">
          <BackButton to="/seller/products" />

          <div className="mx-auto max-w-xl">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {isEditing ? "Edit Product" : "Add New Product"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Images */}
                  <div className="space-y-2">
                    <Label>Product Images *</Label>
                    <div className="flex flex-wrap gap-2">
                      {/* Existing Images */}
                      {existingImages.map((url, index) => (
                        <div key={`existing-${index}`} className="relative">
                          <img
                            src={url}
                            alt={`Product ${index + 1}`}
                            className="h-20 w-20 rounded-lg object-cover border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(index)}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {/* New Image Previews */}
                      {imagePreviews.map((preview, index) => (
                        <div key={`new-${index}`} className="relative">
                          <img
                            src={preview}
                            alt={`New ${index + 1}`}
                            className="h-20 w-20 rounded-lg object-cover border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => removeNewImage(index)}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {/* Upload Button */}
                      {existingImages.length + imageFiles.length < 5 && (
                        <label className="h-20 w-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground mt-1">Add</span>
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add up to 5 images. First image is the main photo.
                    </p>
                  </div>

                  {/* Product Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter product name"
                      required
                    />
                  </div>

                  {/* Price & Quantity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price (XCD) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="1"
                        required
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose a category to help customers find your product
                    </p>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label>Meetup Location</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your product..."
                      rows={3}
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/seller/products")}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : isEditing ? (
                        "Update Product"
                      ) : (
                        "Create Product"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SellerRouteGuard>
  );
}
