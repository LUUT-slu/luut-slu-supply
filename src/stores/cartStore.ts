import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ShopifyProduct } from '@/lib/shopify';
import { trackAnalyticsEvent } from '@/hooks/useAnalyticsTracker';

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

interface CartStore {
  items: CartItem[];
  isLoading: boolean;
  isOpen: boolean;
  
  addItem: (item: CartItem) => { success: boolean; error?: string };
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setLoading: (loading: boolean) => void;
  setOpen: (open: boolean) => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getCurrentSeller: () => string | null;
  getUniqueVendors: () => string[];
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isOpen: false,

      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find(i => i.variantId === item.variantId);
        
        if (existingItem) {
          set({
            items: items.map(i =>
              i.variantId === item.variantId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            )
          });
        } else {
          set({ items: [...items, item] });
        }

        // Fire-and-forget analytics
        trackAnalyticsEvent({
          eventType: "add_to_cart",
          productId: item.product.node.id,
          productName: item.product.node.title,
          productCategory: item.product.node.productType || undefined,
          sellerId: item.product.node.vendor || undefined,
          metadata: { variantId: item.variantId, quantity: item.quantity },
        });
        
        return { success: true };
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        
        set({
          items: get().items.map(item =>
            item.variantId === variantId ? { ...item, quantity } : item
          )
        });
      },

      removeItem: (variantId) => {
        set({
          items: get().items.filter(item => item.variantId !== variantId),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setOpen: (isOpen) => set({ isOpen }),

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTotalPrice: () => {
        return get().items.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0
        );
      },
      
      getCurrentSeller: () => {
        const { items } = get();
        if (items.length === 0) return null;
        return items[0].product.node.vendor || null;
      },

      getUniqueVendors: () => {
        const { items } = get();
        const vendors = items
          .map(i => i.product.node.vendor)
          .filter(Boolean) as string[];
        return [...new Set(vendors)];
      },
    }),
    {
      name: 'luut-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
